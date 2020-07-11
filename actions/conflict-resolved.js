module.exports = ({config, context, github, io, core}) => {
    (async () => {
        let parse_propagation_issue = (() => {
            const path = require('path')
            const script_path = path.resolve('./actions/helpers/parse-propagation-issue.js')
            return require(script_path)
        })()
        let file_propagation_pr = (() => {
            const path = require('path')
            const script_path = path.resolve('./actions/helpers/file-propagation-pr.js')
            return require(script_path)
        })()
        let parse_commands = (() => {
            const path = require('path')
            const script_path = path.resolve('./actions/helpers/parse-commands.js')
            return require(script_path)
        })()

        const { data: comment } = await github.issues.getComment({
            owner: config.central_repo_owner,
            repo: config.central_repo_repo,
            comment_id: context.payload.comment.id,
        })
        const result = parse_commands({
            body: comment.body,
            bot_name: config.bot_name,
        })
        if (result.cmd_data.propagation_status !== "?") {
            result.errors.push("Propagation commands are ignored in this context")
        }
        if (result.cmd_data.closings.length > 0) {
            result.errors.push("Closing commands are ignored in this context")
        }
        if (result.errors.length > 0) {
            await github.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.issue.number,
                body: result.errors.join("\n"),
            })
            throw 42
        }
        // TODO: ensure that the branch actually exists
        if (result.cmd_data.resolve_branch !== "") {
            let result2 = parse_propagation_issue({
                body: context.payload.issue.body
            })
            if (result2.errors.length > 0) {
                await github.issues.createComment({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    issue_number: context.payload.issue.number,
                    body: result2.errors.join("\n"),
                })
                throw 42
            }
            await file_propagation_pr({
                github: github,
                pr_data: result2.pr_data,
                head_branch: result.cmd_data.resolve_branch,
                issue_number: context.payload.issue.number,
                target_column_id: config.central_awaiting_review_column_id,
                bot_name: config.bot_name,
                central_owner: config.central_repo_owner,
                central_repo: config.central_repo_repo,
            })
        }
    })()
}
