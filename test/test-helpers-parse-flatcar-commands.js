let assert = require('chai').assert
const path = require('path')
let mockdate = require('mockdate')

describe('parse-flatcar-commands', function() {
    const script_path = path.resolve('./actions/helpers/parse-flatcar-commands.js')
    const parse_flatcar_commands = require(script_path)
    // months are 0-based, so 6 is for July, not June
    const current_date = new Date(2020, 6, 11, 21, 28, 33, 456)

    beforeEach(() => {
        mockdate.set(current_date)
    })

    afterEach(() => {
        mockdate.reset()
    })

    it('validates the branches and augments the command parsing results', function() {
        let testcases = [
            {
                msg: "propagate from alpha to beta and stable",
                input: {
                    body: "@bot propagate beta 2020-07-11, stable 2020-07-21",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-beta": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "yes",
                    propagation_branches: [
                        {
                            desc: "beta",
                            date: new Date(2020, 6, 11, 12),
                            name: "flatcar-master-beta",
                        },
                        {
                            desc: "stable",
                            date: new Date(2020, 6, 21, 12),
                            name: "flatcar-master",
                        },
                    ],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "propagate from alpha to stable, no beta in repo",
                input: {
                    body: "@bot propagate stable 2020-07-21",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "yes",
                    propagation_branches: [
                        {
                            desc: "stable",
                            date: new Date(2020, 6, 21, 12),
                            name: "flatcar-master",
                        },
                    ],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "nothing to propagate",
                input: {
                    body: "@bot no-propagate",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-beta": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
        ]
        for (let testcase of testcases) {
            const result = parse_flatcar_commands(testcase.input)
            assert.isEmpty(result.errors, `${testcase.msg} failed (${result.errors})`)
            assert.deepEqual(result.cmd_data, testcase.output, `${testcase.msg} failed`)
        }
    })

    it('should fail on invalid commands', function() {
        let testcases = [
            {
                msg: "propagate from alpha to stable, missing beta",
                input: {
                    body: "@bot propagate stable 2020-07-21",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-beta": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
            },
            {
                msg: "missing propagation commands",
                input: {
                    body: "",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-beta": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
            },
            {
                msg: "wrong direction of propagation",
                input: {
                    body: "@bot: propagate beta 2020-07-11",
                    target_branch: "flatcar-master",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-beta": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
            },
            {
                msg: "propagating to the nonexistent branch",
                input: {
                    body: "@bot: propagate beta 2020-07-11",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
            },
            {
                msg: "propagating to the bogus branch",
                input: {
                    body: "@bot: propagate bogus 2020-07-11",
                    target_branch: "flatcar-master-alpha",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
            },
            {
                msg: "propagating to the bogus branch, where even no valid propagation branches exist",
                input: {
                    body: "@bot: propagate bogus 2020-07-11",
                    target_branch: "flatcar-master",
                    branches_set: {
                        "flatcar-master": true,
                        "flatcar-master-alpha": true,
                    },
                    branch_map: [
                        ["alpha", "flatcar-master-alpha"],
                        ["beta", "flatcar-master-beta"],
                        ["stable", "flatcar-master"],
                    ],
                    bot_name: "bot",
                },
            },
        ]
        for (let testcase of testcases) {
            const result = parse_flatcar_commands(testcase.input)
            assert.isNotEmpty(result.errors, `${testcase.msg} failed`)
        }
    })
})
