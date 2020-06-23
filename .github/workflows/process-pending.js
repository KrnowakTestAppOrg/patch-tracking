module.exports = ({context, github, io, core}) => {
    (async () => {
        const kicker_issue_number = 7

        if (context.payload.issue === null || context.payload.issue.number !== kicker_issue_number) {
            console.log("skipping the checks")
        }

        const bot_name = "krnowak-test-bot"
        const central_pending_column_id = 9723463
        const central_awaiting_review_column_id = 9723464
        const central_needs_manual_intervention_column_id = 9723465
        let date_desc_re = /^\s*((\d{4})-(\d{1,2})-(\d{1,2}))\s*$/
        let page = 0
        const per_page = 100
        let date = new Date()
        date = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12)
        const util = require('util')
        const exec = util.promisify(require('child_process').exec)

        while (1) {
            page++
            const { data: cards } = await github.projects.listCards({
                column_id: central_pending_column_id,
                page: page,
                per_page: per_page,
            })
            card_loop:
            for (let card of cards) {
                if (card.note !== null) {
                    console.log("card is not an issue card", card.url)
                    continue
                }
                // content_url looks like
                // https://api.github.com/repos/KrnowakTestAppOrg/proj/issues/6
                const parts = card.content_url.split('/')
                if (parts.length < 4) {
                    console.log("bogus content url", card.content_url)
                }
                const issue_num_idx = parts.length - 1
                const content_type_idx = parts.length - 2
                const repo_idx = parts.length - 3
                const owner_idx = parts.length - 4
                const owner = parts[owner_idx]
                const repo = parts[repo_idx]
                if (parts[content_type_idx] !== 'issues') {
                    console.log("issue url:", card.content_url, "not the expected content type, got:", parts[content_type_idx], "expected:", 'issues')
                    continue
                }
                const issue_number = parts[issue_num_idx]
                if (isNaN(issue_number)) {
                    console.log("issue url:", card.content_url, "issue number is not a number, got:", issue_number)
                    continue
                }
                const { data: issue } = await github.issues.get({
                    owner: owner,
                    repo: repo,
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
                for (const arg of [core.getInput('github-token'), owner, repo, pr_data.branch, bot_branch, ...pr_data.commits]) {
                    escaped_args.push(escape(arg))
                }
                try {
                    await exec(`./.github/workflows/git-heavy-lifting.sh ${escaped_args.join(' ')}`)
                    await github.projects.moveCard({
                        card_id: card.id,
                        position: "top",
                        column_id: central_awaiting_review_column_id,
                    })
                    const { data: filed_pr } = await github.pulls.create({
                        owner: owner,
                        repo: repo,
                        title: `Propagate PR ${pr_data.pr} to ${pr_data.branch}`,
                        head: bot_branch,
                        base: pr_data.branch,
                        body: [
                            `@${bot_name}: ignore`,
                            "",
                            `Fixes #${issue_number}`,
                            "",
                            `Based on PR #${pr_data.pr}`
                        ].join("\n"),
                    })
                    await github.issues.createComment({
                        owner: owner,
                        repo: repo,
                        issue_number: issue_number,
                        body: `Filed #${filed_pr.number}.`,
                    })
                } catch ({error, stdout, stderr}) {
                    await github.projects.moveCard({
                        card_id: card.id,
                        position: "top",
                        column_id: central_needs_manual_intervention_column_id,
                    })
                    await github.issues.createComment({
                        owner: owner,
                        repo: repo,
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
    })();
}
