module.exports = {
	env: {
		es6: true,
		node: true,
		jest: true
	},
	extends: [
		'standard',
		'plugin:jest/recommended'
	],
	globals: {
		Atomics: 'readonly',
		SharedArrayBuffer: 'readonly'
	},
	parser: '@typescript-eslint/parser',
	parserOptions: {
		ecmaVersion: 11,
		sourceType: 'module'
	},
	plugins: [
		'@typescript-eslint'
	],
	rules: {
		// Tabs instead of spaces (for the visually impaired!) (https://www.reddit.com/r/javascript/comments/c8drjo/nobody_talks_about_the_real_reason_to_use_tabs/)
		'no-tabs': 0,
		'no-mixed-spaces-and-tabs': 1,
		indent: ['error', 'tab', { SwitchCase: 1 }],
		'no-unused-vars': 0
	}
}
