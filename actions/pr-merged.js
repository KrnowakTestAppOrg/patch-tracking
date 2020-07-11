module.exports = ({config, context, github, io, core}) => {
    (async () => {
        const pr_data_to_issue_body = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./actions/helpers/pr-data-to-issue-body.js')
            return require(scriptPath)
        })()
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
        const get_pr_commits = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./actions/helpers/get-pr-commits.js')
            return require(scriptPath)
        })()

        try {
            await github.pulls.checkIfMerged({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
            })
        } catch (error) {
            console.log(`PR closed, skipping`, error)
            return
        }
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
            config: config,
            target_branch: pr.base.ref,
            branches_set: flatcar_branches,
        })
        if (result.cmd_data.resolve_branch !== "") {
            result.errors.push("Resolve branch commands are ignored in this context.")
        }
        if (result.errors.length === 0 && result.cmd_data.propagation_status === "yes") {
            let result2 = await get_pr_commits({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                github: github,
            })
            if (result2.error !== "") {
                result.errors.push(result2.error)
            } else {
                const pr_title = pr.title.trim().replace(/\n/g, " ")
                for (let prop_branch of result.cmd_data.propagation_branches) {
                    if (prop_branch.date === null) {
                        continue
                    }
                    let pr_data = {
                        owner: context.repo.owner,
                        repo: context.repo.repo,
                        pr: context.payload.pull_request.number,
                        branch: prop_branch.name,
                        filed_pr_url: "",
                        card_id: 0,
                        date: prop_branch.date,
                        title: pr_title,
                        commits: result2.commits,
                    }
                    const { data: issue } = await github.issues.create({
                        owner: config.central_repo_owner,
                        repo: config.central_repo_repo,
                        title: `For ${prop_branch.name}: ${pr.title}`,
                        body: pr_data_to_issue_body({
                            pr_data: pr_data,
                        }),
                    })
                    await github.projects.createCard({
                        column_id: config.central_pending_column_id,
                        content_id: issue.id,
                        content_type: "Issue",
                    })
                }
            }
        }
        if (result.errors.length === 0) {
            for (let issue_number of result.cmd_data.closings) {
                await github.issues.update({
                    owner: config.central_repo_owner,
                    repo: config.central_repo_repo,
                    issue_number: issue_number,
                    state: "closed",
                })
            }
        }
        if (result.errors.length > 0) {
            await github.issues.createComment({
                owner: context.repo.owner,
                repo: context.repo.repo,
                pull_number: context.payload.pull_request.number,
                body: ["Errors encountered during processing the merged PR:", "", ...result.errors, "", "After fixing them, re-run the pr-merged job."].join("\n"),
            })
        }
    })()
}
