module.exports = () => {
    return {
        bot_name: "krnowak-test-bot",
        bot_email: "krnowak.test.bot@gmail.com",
        bot_git_name: "Test Bot",
        central_repo_owner: "KrnowakTestAppOrg",
        central_repo_repo: "central",
        central_pending_column_id: 9618257,
        central_awaiting_review_column_id: 9618258,
        central_needs_manual_intervention_column_id: 9618260,
        kicker_issue_number: 7,
        // The order is important, it's possible to propagate from a
        // branch to all the branches below it.
        short_to_full_branch_map: [
            ["edge", "flatcar-master-edge"],
            ["alpha", "flatcar-master-alpha"],
            ["beta", "flatcar-master-beta"],
            ["stable", "flatcar-master"],
        ],
    }
}
