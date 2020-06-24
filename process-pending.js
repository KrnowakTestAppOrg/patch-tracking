module.exports = ({context, github, io, core}) => {
    (async () => {
        const config = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./config.js')
            return require(scriptPath)()
        })()
        if (context.payload.issue === null || context.payload.issue.number !== config.kicker_issue_number) {
            console.log("skipping the checks")
            return
        }

        let date_desc_re = /^\s*((\d{4})-(\d{1,2})-(\d{1,2}))\s*$/
        let issue_number_re = /^\s*(\d+)\s*$/
        let page = 0
        const per_page = 100
        let date = new Date()
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
        const util = require('util')
        const exec = util.promisify(require('child_process').exec)

        while (1) {
            page++
            const { data: cards } = await github.projects.listCards({
                column_id: config.central_pending_column_id,
                page: page,
                per_page: per_page,
            })
            card_loop:
            for (let card of cards) {
                if (card.note !== null) {
                    console.log("card is not an issue card", card.url)
                    continue
                }
                // https://api.github.com/repos/KrnowakTestAppOrg/central/issues/6
                const parts = card.content_url.split('/')
                if (parts.length < 4) {
                    console.log("bogus content url", card.content_url)
                }
                const issue_num_idx = parts.length - 1
                const content_type_idx = parts.length - 2
                const repo_idx = parts.length - 3
                const owner_idx = parts.length - 4
                if (parts[owner_idx] !== config.central_repo_owner) {
                    console.log("issue url:", card.content_url, "outside the expected owner, got:", parts[owner_idx], "expected:", config.central_repo_owner)
                    continue
                }
                if (parts[repo_idx] !== config.central_repo_repo) {
                    console.log("issue url:", card.content_url, "outside the expected repo, got:", parts[repo_idx], "expected:", config.central_repo_repo)
                    continue
                }
                if (parts[content_type_idx] !== 'issues') {
                    console.log("issue url:", card.content_url, "not the expected content type, got:", parts[content_type_idx], "expected:", 'issues')
                    continue
                }
                let match = parts[issue_num_idx].match(issue_number_re)
                if (match === null || match.length !== 2) {
                    console.log("issue url:", card.content_url, "issue number is not a number, got:", parts[issue_num_idx])
                    continue
                }
                const issue_number = match[1]
                const { data: issue } = await github.issues.get({
                    owner: config.central_repo_owner,
                    repo: config.central_repo_repo,
                    issue_number: issue_number,
                })
                const lines = issue.body.split("\n")
                let commits_now = false
                let pr_data = {
                    commits: [],
                }
                lines_loop:
                for (let line of lines) {
                    line = line.trim()
                    if (line.length === 0) {
                        continue
                    }
                    if (!commits_now) {
                        let [key, ...values] = line.split(':')
                        let value = values.join(':')
                        key = key.trim()
                        value = value.trim()
                        switch (key) {
                        case 'owner':
                            pr_data.owner = value
                            break
                        case 'repo':
                            pr_data.repo = value
                            break
                        case 'original-pr':
                            pr_data.pr = value
                            break
                        case 'branch':
                            pr_data.branch = value
                            break
                        case 'date':
                            let match = value.match(date_desc_re)
                            if (match === null || match.length !== 5) {
                                console.log(`invalid date ${value} in issue ${issue_number}`)
                                continue card_loop
                            }
                            const year = parseInt(match[2], 10)
                            const month = parseInt(match[3], 10)
                            const day = parseInt(match[4], 10)
                            // months are zero-based in Date, but we
                            // use 1-based in our messages
                            let issue_date = new Date(year, month-1, day, 12)
                            if ((issue_date.getFullYear() !== year) || (issue_date.getMonth() !== month-1) || (issue_date.getDate() !== day)) {
                                console.log(`issue ${issue_number} has bogus date ${value} (actually ${issue_date.getFullYear()}-${issue_date.getMonth()+1}-${issue_date.getDate()})`)
                                continue card_loop
                            }
                            let process = false
                            if (year < date.getFullYear()) {
                                process = true
                            } else if (year > date.getFullYear()) {
                            } else if (month-1 < date.getMonth()) {
                                process = true
                            } else if (month-1 > date.getMonth()) {
                            } else if (day <= issue_date.getDate()) {
                                process = true
                            }
                            if (!process) {
                                console.log(`not processing issue ${issue_number}, it's time hasn't yet come (issues ${value} vs now ${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()})`)
                                continue card_loop
                            }
                            break
                        case 'commits':
                            commits_now = true
                            break
                        }
                    } else {
                        if (/^[0-9A-Fa-f]{40}$/.test(line)) {
                            pr_data.commits.push(line)
                        } else {
                            console.log(`${line} in issue ${issue_number} is not a valid commit`)
                            continue card_loop
                        }
                    }
                }
                let escape = (str) => {
                    let escaped = str.replace(/'/gi, "'\\''");
                    return `'${escaped}'`
                }
                const bot_branch = `test-bot/propagate-pr-${pr_data.pr}-${pr_data.branch}`
                let escaped_args = []
                for (const arg of [core.getInput('github-token'), pr_data.owner, pr_data.repo, pr_data.branch, bot_branch, ...pr_data.commits]) {
                    escaped_args.push(escape(arg))
                }
                try {
                    await exec(`./git-heavy-lifting.sh ${escaped_args.join(' ')}`)
                    await github.projects.moveCard({
                        card_id: card.id,
                        position: "top",
                        column_id: config.central_awaiting_review_column_id,
                    })
                    const { data: filed_pr } = await github.pulls.create({
                        owner: pr_data.owner,
                        repo: pr_data.repo,
                        title: `Propagate PR ${pr_data.pr} to ${pr_data.branch}`,
                        head: bot_branch,
                        base: pr_data.branch,
                        body: [
                            `@${config.bot_name}: close ${issue_number}`,
                            `@${config.bot_name}: no-propagate`,
                            "",
                            `Based on PR #${pr_data.pr}`
                        ].join("\n"),
                    })
                    await github.issues.createComment({
                        owner: config.central_repo_owner,
                        repo: config.central_repo_repo,
                        issue_number: issue_number,
                        body: `Filed ${filed_pr.html_url}.`,
                    })
                } catch ({error, stdout, stderr}) {
                    await github.projects.moveCard({
                        card_id: card.id,
                        position: "top",
                        column_id: config.central_needs_manual_intervention_column_id,
                    })
                    await github.issues.createComment({
                        owner: config.central_repo_owner,
                        repo: config.central_repo_repo,
                        issue_number: issue_number,
                        body: [
                            "stdout:",
                            "",
                            "```",
                            stdout,
                            "```",
                            "",
                            "stderr:",
                            "",
                            "```",
                            stderr,
                            "```",
                        ].join("\n"),
                    })
                }
            }
            if (cards.length < per_page) {
                break
            }
        }
    })()
}
