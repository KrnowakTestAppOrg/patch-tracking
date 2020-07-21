const assert = require('chai').assert
const path = require('path')
const github = require(path.resolve('./test/mock/github.js'))

describe('get-flatcar-branches', function() {
    const script_path = path.resolve('./actions/helpers/get-flatcar-branches.js')
    const get_flatcar_branches = require(script_path)
    let ghsm
    let ghkit

    before(async () => {
        ghsm = await github()
        ghkit = ghsm.get_octokit()
    })

    after(async () => {
        await ghsm.close()
    })

    it('gets all the available flatcar branches', async function() {
        const owner = 'me'
        const repo = 'my-repo'
        const branch_map = [
            ['s1', 'branch-1'],
            ['s2', 'branch-2'],
            ['s3', 'branch-3'],
        ]
        let testcases = [
            {
                msg: 'repo has all the branches',
                in_repo: [
                    'branch-1',
                    'branch-2',
                    'branch-3',
                ],
                expected: {
                    'branch-1': true,
                    'branch-2': true,
                    'branch-3': true,
                }
            },
            {
                msg: 'repo has all the branches and some more',
                in_repo: [
                    'something-or-else-1',
                    'branch-1',
                    'something-or-else-2',
                    'branch-2',
                    'something-or-else-3',
                    'branch-3',
                    'something-or-else-4',
                ],
                expected: {
                    'branch-1': true,
                    'branch-2': true,
                    'branch-3': true,
                }
            },
            {
                msg: 'repo has only some branches',
                in_repo: [
                    'branch-1',
                    'branch-3',
                ],
                expected: {
                    'branch-1': true,
                    'branch-3': true,
                }
            },
            {
                msg: 'repo has only other branches',
                in_repo: [
                    'something-or-else-1',
                    'something-or-else-2',
                    'something-or-else-4',
                ],
                expected: {
                }
            },
            {
                msg: 'repo has a ton of branches',
                in_repo: (() => {
                    let branches = []
                    for (let i = 0; i < 3; i++) {
                        for (let j = 0; j < 100; j++) {
                            branches.push(`something-or-else-${i * 100 + j}`)
                        }
                        branches.push(`branch-${i+1}`)
                    }
                    return branches
                })(),
                expected: {
                    'branch-1': true,
                    'branch-2': true,
                    'branch-3': true,
                }
            },
        ]
        for (let testcase of testcases) {
            ghsm.add_route('GET', `/repos/${owner}/${repo}/branches`, (paginator) => {
                let branches = []
                for (const name of testcase.in_repo) {
                    branches.push({name: name})
                }
                return JSON.stringify(paginator(branches))
            })
            const result = await get_flatcar_branches({
                owner: owner,
                repo: repo,
                github: ghkit,
                branch_map: branch_map,
            })
            assert.deepEqual(result, testcase.expected, `${testcase.msg}`)
        }
    })
})
