const assert = require('chai').assert
const path = require('path')
const github = require(path.resolve('./test/mock/github.js'))

describe('get-pr-commits', function() {
    const script_path = path.resolve('./actions/helpers/get-pr-commits.js')
    const get_pr_commits = require(script_path)
    let ghsm
    let ghkit

    before(async () => {
        ghsm = await github()
        ghkit = ghsm.get_octokit()
    })

    after(async () => {
        await ghsm.close()
    })

    it('gets all the pull request commits', async function() {
        const owner = 'me'
        const repo = 'my-repo'
        const pull_number = 42
        let testcases = [
            {
                msg: 'gets the commits',
                in_pull: [
                    {
                        message: "first commit in PR",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000001',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000002',
                    },
                    {
                        message: "second commit in PR",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000002',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000003',
                    },
                    {
                        message: "third commit in PR",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000003',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000004',
                    },
                ],
                expected: [
                    '0000000000000000000000000000000000000002',
                    '0000000000000000000000000000000000000003',
                    '0000000000000000000000000000000000000004',
                ]
            },
            {
                msg: 'gets the commits and sorts them properly',
                in_pull: [
                    {
                        message: "third commit in PR",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000003',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000004',
                    },
                    {
                        message: "second commit in PR",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000002',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000003',
                    },
                    {
                        message: "first commit in PR",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000001',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000002',
                    },
                ],
                expected: [
                    '0000000000000000000000000000000000000002',
                    '0000000000000000000000000000000000000003',
                    '0000000000000000000000000000000000000004',
                ]
            },
        ]
        for (let testcase of testcases) {
            ghsm.add_route('GET', `/repos/${owner}/${repo}/pulls/${pull_number}/commits`, (paginator) => {
                return JSON.stringify(paginator(testcase.in_pull))
            })
            const result = await get_pr_commits({
                owner: owner,
                repo: repo,
                pull_number: pull_number,
                github: ghkit,
            })
            assert.isEmpty(result.error, `${testcase.msg} failed (${result.error})`)
            assert.deepEqual(result.commits, testcase.expected, `${testcase.msg}`)
        }
    })


    it('bails out on weird pull requests', async function() {
        const owner = 'me'
        const repo = 'my-repo'
        const pull_number = 42
        let testcases = [
            {
                msg: 'fails when some commit in pull request has multiple parents',
                in_pull: [
                    {
                        message: "merge commit or something",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000001',
                            },
                            {
                                sha: '0000000000000000000000000000000000000011',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000002',
                    },
                ],
            },
            {
                msg: 'fails when some commit in pull request has multiple children',
                in_pull: [
                    {
                        message: "diverge commit",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000001',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000002',
                    },
                    {
                        message: "some commit from the diverge",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000002',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000003',
                    },
                    {
                        message: "other commit from the diverge",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000002',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000004',
                    },
                ],
            },
            {
                msg: 'nut case - pull request has no commits?',
                in_pull: [
                ],
            },
            {
                msg: 'nut case - repeated commits',
                in_pull: [
                    {
                        message: "some commit",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000001',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000002',
                    },
                    {
                        message: "some commit",
                        parents: [
                            {
                                sha: '0000000000000000000000000000000000000001',
                            },
                        ],
                        sha: '0000000000000000000000000000000000000002',
                    },
                ],
            },
        ]
        for (let testcase of testcases) {
            ghsm.add_route('GET', `/repos/${owner}/${repo}/pulls/${pull_number}/commits`, (paginator) => {
                return JSON.stringify(paginator(testcase.in_pull))
            })
            const result = await get_pr_commits({
                owner: owner,
                repo: repo,
                pull_number: pull_number,
                github: ghkit,
            })
            assert.isNotEmpty(result.error, `${testcase.msg} failed`)
        }
    })
})
