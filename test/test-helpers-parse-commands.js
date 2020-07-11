let assert = require('chai').assert



describe('parse-commands', function() {
    const path = require('path')
    const script_path = path.resolve('./actions/helpers/parse-commands.js')
    const parse_commands = require(script_path)

    // months are 0-based, so 6 is for July, not June
    const current_date = new Date(2020, 6, 11, 21, 28, 33, 456)
    let real_Date = Date
    global.Date = class extends Date {
        constructor(date) {
            if (date) {
                return super(date)
            }

            return current_date
        }
    }

    it('should parse valid commands correctly', function() {
        let testcases = [
            {
                msg: "whitespace separated command",
                input: {
                    body: "@bot no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "colon separated command",
                input: {
                    body: "@bot: no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "comma separated command",
                input: {
                    body: "@bot, no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "colon separated command with extra whitespace",
                input: {
                    body: "@bot : no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "comma separated command with extra whitespace",
                input: {
                    body: "@bot , no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "colon separated command with no whitespace",
                input: {
                    body: "@bot:no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "comma separated command with no whitespace",
                input: {
                    body: "@bot,no-propagate",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "no",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "close command",
                input: {
                    body: "@bot: close 42",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "?",
                    propagation_branches: [],
                    closings: [42],
                    resolve_branch: "",
                },
            },
            {
                msg: "propagate command with single description",
                input: {
                    body: "@bot: propagate stable asap",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "yes",
                    propagation_branches: [
                        {
                            desc: "stable",
                            date: new Date(2020, 6, 11, 12)
                        },
                    ],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "propagate command with many descriptions",
                input: {
                    body: "@bot: propagate stable nope, alpha 2020-7-12, beta 2m, gamma 1w, delta 4d",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "yes",
                    propagation_branches: [
                        {
                            desc: "stable",
                            date: null,
                        },
                        {
                            desc: "alpha",
                            // months are 0-based, so 6 for July, not 7
                            date: new Date(2020, 6, 12, 12)
                        },
                        {
                            desc: "beta",
                            date: new Date(2020, 8, 11, 12)
                        },
                        {
                            desc: "gamma",
                            date: new Date(2020, 6, 18, 12)
                        },
                        {
                            desc: "delta",
                            date: new Date(2020, 6, 15, 12)
                        },
                    ],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "many propagate commands with single descriptions",
                input: {
                    body: [
                        "@bot: propagate stable nope",
                        "@bot: propagate alpha 2020-7-12",
                        "@bot: propagate beta 2m",
                        "@bot: propagate gamma 1w",
                        "@bot: propagate delta 4d",
                    ].join("\n"),
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "yes",
                    propagation_branches: [
                        {
                            desc: "stable",
                            date: null,
                        },
                        {
                            desc: "alpha",
                            // months are 0-based, so 6 for July, not 7
                            date: new Date(2020, 6, 12, 12)
                        },
                        {
                            desc: "beta",
                            date: new Date(2020, 8, 11, 12)
                        },
                        {
                            desc: "gamma",
                            date: new Date(2020, 6, 18, 12)
                        },
                        {
                            desc: "delta",
                            date: new Date(2020, 6, 15, 12)
                        },
                    ],
                    closings: [],
                    resolve_branch: "",
                },
            },
            {
                msg: "resolve command",
                input: {
                    body: "@bot: resolve my/branch",
                    bot_name: "bot",
                },
                output: {
                    propagation_status: "?",
                    propagation_branches: [],
                    closings: [],
                    resolve_branch: "my/branch",
                },
            },
        ]
        for (let testcase of testcases) {
            const result = parse_commands(testcase.input)
            assert.isEmpty(result.errors, result.errors)
            assert.deepEqual(result.cmd_data, testcase.output)
        }
    })

    it('should fail on invalid commands', function() {
        let testcases = [
            {
                msg: "no-propagate with an extra parameter",
                input: {
                    body: "@bot: no-propagate stable",
                    bot_name: "bot",
                },
            },
            {
                msg: "no-propagate, then propagate",
                input: {
                    body: [
                        "@bot, no-propagate",
                        "@bot, propagate stable 1w",
                    ].join("\n"),
                    bot_name: "bot",
                },
            },
            {
                msg: "close with no params",
                input: {
                    body: "@bot : close",
                    bot_name: "bot",
                },
            },
            {
                msg: "close with too many params",
                input: {
                    body: "@bot , close 12 34",
                    bot_name: "bot",
                },
            },
            {
                msg: "close with not a number",
                input: {
                    body: "@bot:close abc",
                    bot_name: "bot",
                },
            },
            {
                msg: "close with negative number",
                input: {
                    body: "@bot,close -12",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate, then no-propagate",
                input: {
                    body: [
                        "@bot, propagate stable 1w",
                        "@bot, no-propagate",
                    ].join("\n"),
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with no descriptions",
                input: {
                    body: "@bot: propagate",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with too many words (or missing comma)",
                input: {
                    body: "@bot: propagate stable asap alpha nope",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with repeated description",
                input: {
                    body: "@bot: propagate stable nope, stable nope",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with bogus date",
                input: {
                    body: "@bot: propagate stable 2020-13-45",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with negative relative date in days",
                input: {
                    body: "@bot: propagate stable -1d",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with negative relative date in weeks",
                input: {
                    body: "@bot: propagate stable -1w",
                    bot_name: "bot",
                },
            },
            {
                msg: "propagate with negative relative date in months",
                input: {
                    body: "@bot: propagate stable -1m",
                    bot_name: "bot",
                },
            },
            {
                msg: "resolve with no branch",
                input: {
                    body: "@bot: resolve",
                    bot_name: "bot",
                },
            },
            {
                msg: "resolve with too many branches",
                input: {
                    body: "@bot: resolve my/branch my/branch",
                    bot_name: "bot",
                },
            },
            {
                msg: "repeated resolve",
                input: {
                    body: [
                        "@bot: resolve my/branch",
                        "@bot: resolve my/branch",
                    ].join("\n"),
                    bot_name: "bot",
                },
            },
            {
                msg: "unknown command",
                input: {
                    body: "@bot an-invalid-command",
                    bot_name: "bot",
                },
            },
        ]
        for (let testcase of testcases) {
            const result = parse_commands(testcase.input)
            assert.isNotEmpty(result.errors)
        }
    })

    global.Date = real_Date
})
