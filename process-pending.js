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

        let parse_propagation_issue = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./parse-propagation-issue.js')
            return require(scriptPath)
        })()
        let file_propagation_pr = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./file-propagation-pr.js')
            return require(scriptPath)
        })

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
                let result = parse_propagation_issue(issue.body)
                if (result.errors.length > 0) {
                    for (let error of result.errors) {
                        console.log(error)
                    }
                    continue card_loop
                }
                let pr_data = result.pr_data
                let process = false
                if (pr_data.date.getFullYear() < date.getFullYear()) {
                    process = true
                } else if (pr_data.date.getFullYear() > date.getFullYear()) {
                } else if (pr_data.date.getMonth() < date.getMonth()) {
                    process = true
                } else if (pr_data.date.getMonth() > date.getMonth()) {
                } else if (pr_data.date.getDate() <= date.getDate()) {
                    process = true
                }
                if (!process) {
                    const issue_date = `${pr_data.date.getFullYear()}-${pr_data.date.getMonth()+1}-${pr_data.date.getDate()}`
                    const now_date = `${date.getFullYear()}-${date.getMonth()+1}-${date.getDate()}`
                    console.log(`not processing issue ${issue_number}, it's time hasn't yet come (issues ${issue_date} vs now ${now_date})`)
                    continue card_loop
                }
                let escape = (str) => {
                    let escaped = str.replace(/'/gi, "'\\''");
                    return `'${escaped}'`
                }
                const bot_branch = `test-bot/propagate-pr-${pr_data.pr}-${pr_data.branch}`
                let escaped_args = []
                const gh_token = core.getInput('github-token')
                for (const arg of [gh_token, pr_data.owner, pr_data.repo, pr_data.branch, bot_branch, config.bot_email, config.bot_git_name, ...pr_data.commits]) {
                    escaped_args.push(escape(arg))
                }
                try {
                    await exec(`./git-heavy-lifting.sh ${escaped_args.join(' ')}`)
                    pr_data.card_id = card.id
                    await file_propagation_pr({github, config, pr_data, bot_branch, issue_number})
                } catch ({name, message, stdout: output}) {
                    await github.projects.moveCard({
                        card_id: card.id,
                        position: "top",
                        column_id: config.central_needs_manual_intervention_column_id,
                    })
                    await github.issues.update({
                        owner: config.central_repo_owner,
                        repo: config.central_repo_repo,
                        issue_number: issue_number,
                        body: [issue.body, `card-id: ${card.id}`].join("\n")
                    })
                    let escapeRegex = (str) => {
                        return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')
                    }
                    let token_re = new RegExp(escapeRegex(gh_token), "gi")
                    let email_re = new RegExp(escapeRegex(config.bot_email), "gi")
                    const token_sub = "<redacted_token>"
                    const email_sub = "<redacted_email>"
                    const redacted_name = name.replace(token_re, token_sub).replace(email_re, email_sub)
                    const redacted_message = message.replace(token_re, token_sub).replace(email_re, email_sub)
                    const redacted_output = output.replace(token_re, token_sub).replace(email_re, email_sub)
                    await github.issues.createComment({
                        owner: config.central_repo_owner,
                        repo: config.central_repo_repo,
                        issue_number: issue_number,
                        body: [
                            "error:",
                            "",
                            "```",
                            `${redacted_name}: ${redacted_message}`,
                            "```",
                            "",
                            "output:",
                            "",
                            "```",
                            redacted_output,
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
