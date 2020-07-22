const assert = require('chai').assert
const path = require('path')
let mockdate = require('mockdate')

describe('pr-data-to-issue-body', function() {
    const script_path = path.resolve('./actions/helpers/pr-data-to-issue-body.js')
    const pr_data_to_issue_body = require(script_path)
    const script2_path = path.resolve('./actions/helpers/parse-propagation-issue.js')
    const parse_propagation_issue = require(script2_path)
    // months are 0-based, so 6 is for July, not June
    const current_date = new Date(2020, 6, 11, 12)

    beforeEach(() => {
        mockdate.set(current_date)
    })

    afterEach(() => {
        mockdate.reset()
    })

    it('converts pr_data to a valid issue body', async function() {
        let testcases = [
            {
                msg: "all the fields",
                pr_data: {
                    filed_pr_url: "https://github.com/owner/repo/pull/42",
                    title: "some title",
                    owner: "owner",
                    repo: "repo",
                    pr: 13,
                    branch: "target-branch",
                    date: new Date(),
                    card_id: 1234,
                    commits: [
                        "0000000000000000000000000000000000000001",
                        "0000000000000000000000000000000000000002",
                        "0000000000000000000000000000000000000003",
                    ],
                },
                body: [
                    "filed-pr-url: https://github.com/owner/repo/pull/42",
                    "title: some title",
                    "owner: owner",
                    "repo: repo",
                    "original-pr: 13",
                    "branch: target-branch",
                    "date: 2020-7-11",
                    "card-id: 1234",
                    "commits:",
                    "0000000000000000000000000000000000000001",
                    "0000000000000000000000000000000000000002",
                    "0000000000000000000000000000000000000003",
                ].join("\n")
            },
            {
                msg: "all the required fields",
                pr_data: {
                    filed_pr_url: "",
                    title: "some title",
                    owner: "owner",
                    repo: "repo",
                    pr: 13,
                    branch: "target-branch",
                    date: new Date(),
                    card_id: 0,
                    commits: [
                        "0000000000000000000000000000000000000001",
                        "0000000000000000000000000000000000000002",
                        "0000000000000000000000000000000000000003",
                    ],
                },
                body: [
                    "title: some title",
                    "owner: owner",
                    "repo: repo",
                    "original-pr: 13",
                    "branch: target-branch",
                    "date: 2020-7-11",
                    "commits:",
                    "0000000000000000000000000000000000000001",
                    "0000000000000000000000000000000000000002",
                    "0000000000000000000000000000000000000003",
                ].join("\n")
            },
        ]

        for (let testcase of testcases) {
            const got_body = pr_data_to_issue_body({
                pr_data: testcase.pr_data,
            })
            assert.strictEqual(got_body, testcase.body, `testcase ${testcase.msg} failed`)
            const result = parse_propagation_issue({
                body: got_body,
            })
            assert.isEmpty(result.errors, `testcase ${testcase.msg} failed`)
            assert.deepEqual(result.pr_data, testcase.pr_data)
        }
    })
})
