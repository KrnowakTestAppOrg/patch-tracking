module.exports = ({context, github}) => {
    (async () => {
        const config = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./config.js')
            return require(scriptPath)()
        })()
        const pr_data_to_issue_body = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./pr-data-to-issue-body.js')
            return require(scriptPath)
        })()
        const parse_flatcar_commands = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./parse-flatcar-commands.js')
            return require(scriptPath)
        })()
        const get_flatcar_branches = (() => {
            const path = require('path')
            const scriptPath = path.resolve('./get-flatcar-branches.js')
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
            github: github,
            context: context,
            config: config,
        })
        let result = parse_flatcar_commands({
            body: context.payload.pull_request.body,
            config: config,
            target_branch: pr.base.ref,
            branches_set: flatcar_branches,
        })
        if (result.cmd_data.propagation_status === "yes") {
            let page = 0
            let per_page = 100
            let pr_commits = []
            while (1) {
                // page numbering is 1-based, so we increment it
                // before doing the call
                page++
                const { data: commits } = await github.pulls.listCommits({
                    owner: context.repo.owner,
                    repo: context.repo.repo,
                    pull_number: context.payload.pull_request.number,
                    per_page: per_page,
                    page: page,
                })
                // TODO: I'm not sure if this returns commits sorted
                // by parents.
                for (let commit of commits) {
                    pr_commits.push(commit.sha)
                }
                if (commits.length < per_page) {
                    break
                }
            }
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
                    commits: pr_commits,
                }
                const { data: issue } = await github.issues.create({
                    owner: config.central_repo_owner,
                    repo: config.central_repo_repo,
                    title: `For ${branch.name}: ${pr.title}`,
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
        for (let issue_number of result.cmd_data.closings) {
            await github.issues.update({
                owner: config.central_repo_owner,
                repo: config.central_repo_repo,
                issue_number: issue_number,
                state: "closed",
            })
        }
    })()
}
