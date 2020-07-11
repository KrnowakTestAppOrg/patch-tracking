module.exports = ({config, context, github, io, core}) => {
    (async () => {
        const parse_flatcar_commands = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./actions/helpers/parse-flatcar-commands.js')
            return require(scriptPath)
        })()
        const get_flatcar_branches = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./actions/helpers/get-flatcar-branches.js')
            return require(scriptPath)
        })()

        const { data: pr } = await github.pulls.get({
            owner: context.repo.owner,
            repo: context.repo.repo,
            pull_number: context.payload.pull_request.number,
        })
        const flatcar_branches = await get_flatcar_branches({
            owner: context.repo.owner,
            repo: context.repo.repo,
            github: github,
            branch_map: config.short_to_full_branch_map,
        })
        let result = parse_flatcar_commands({
            body: context.payload.pull_request.body,
            target_branch: pr.base.ref,
            branches_set: flatcar_branches,
            branch_map: config.short_to_full_branch_map,
            bot_name: config.bot_name,
        })
        if (result.cmd_data.resolve_branch !== "") {
            result.errors.push("Resolve branch commands are ignored in this context.")
        }
        if (result.errors.length > 0) {
            await github.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.pull_request.number,
                body: result.errors.join("\n"),
            })
            throw 42
        }
        let messages = []
        for (let issue_number of result.cmd_data.closings) {
            messages.push(`Will close patch tracking issue ${issue_number}.`)
        }
        if (result.cmd_data.propagation_status !== "no") {
            for (let prop_branch of result.cmd_data.propagation_branches) {
                if (prop_branch.date === null) {
                    messages.push(`Will not propagate the changes to ${prop_branch.desc} (${prop_branch.name}).`)
                } else {
                    messages.push(`Will cherry pick the commits to ${prop_branch.desc} (${prop_branch.name}) on ${prop_branch.date.getFullYear()}-${prop_branch.date.getMonth()+1}-${prop_branch.date.getDate()}.`)
                }
            }
        }
        if (messages.length > 0) {
            await github.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                issue_number: context.payload.pull_request.number,
                body: messages.join("\n"),
            })
        }
    })()
}
