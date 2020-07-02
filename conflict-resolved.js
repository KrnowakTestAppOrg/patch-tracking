module.exports = ({context, github, io, core}) => {
    (async () => {
        const config = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./config.js')
            return require(scriptPath)()
        })()
        const { data: comment } = await github.issues.getComment({
            owner: config.central_repo_owner,
            repo: config.central_repo_repo,
            comment_id: context.payload.comment.id,
        })
        const lines = issue.body.split("\n")
        const prefix = `@${config.bot_name}:`
        const errors = []
        const messages = []
        let branch = ""
        lines_loop:
        for (let line of lines) {
            line = line.trim()
            if (!line.startsWith(prefix)) {
                continue
            }
            line = line.slice(prefix.length).trim()
            const [cmd, ...rest] = line.split(/\s+/)
            if (cmd == "resolved") {
                if (rest.length !== 1) {
                    errors.push(`Expected one parameter for the "resolved" command being a name of a branch in "${line}"`)
                    continue
                }
                if (branch.length !== 0) {
                    errors.push(`The branch with resolved conflict is already specified ("${branch}")`)
                    continue
                }
                branch = rest[0]
                continue
            }
            erros.push(`Unknown command "${cmd}". The only available command is "resolved <branch_name>".`)
        }
        if (errors.length > 0) {
            branch = ""
            // TODO: create a comment with errors
        }
        if (branch !== "") {
            const issue_number = context.payload.issue_number
            const { data: issue } = await github.issues.get({
                owner: config.central_repo_owner,
                repo: config.central_repo_repo,
                issue_number: issue_number,
            })
            let result = parse_propagation_issue({body: issue.body})
            if (result.errors.length > 0) {
                for (let error of result.errors) {
                    console.log(error)
                }
                continue card_loop
            }
            let pr_data = result.pr_data
            await file_propagation_pr({github, config, pr_data, head_branch: branch, issue_number})
        }
    })()
}
