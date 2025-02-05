# What is this?

This extension is a simple extension I made to enforce good coding habits and make you put a semicolon at the end of your JavaScript and TypeScript code lines.

This extension is in beta, so be aware that it might not always be perfect. Expect a lot of small releases until this extension exits beta.

# How to Use

## Comments

To ignore a line: Simply insert this comment above the line, like so:

```javascript
// force-semicolon: ignore
function("function without a semicolon")
```

This will ignore the line directly below the comment.

To ignore a file: Simply insert this comment anywhere in the file, like so:

```javascript
// force-semicolon: ignore-all
function("function without a semicolon")
```

This will ignore all semicolon errors in the entire file.

## Settings

- force-semicolon.lintType: setting that decides if VS Code should give an error, warning, or info dialogue
    - Options:
        - Error: red line and notification
        - Warning: yellow line and notification
        - Info: blue line
    - Default: Error

## Commands

- Analyze All Files (`force-semicolon.analyzeAll`): analyze all JavaScript and TypeScript files in the workspace (automatically called when the extension is loaded)

# Changelog

## 0.0.0 - 2/1/25

- Initial release

## 0.1.0 - 2/1/25

- Implemented `ignore` and `ignore-all` (see description)
- Fixed a bug that prevented the extension from finding errors
- Other documentation updates

## 0.1.1 - 2/1/25

- Fixed a bug that also scans JSON files
- Fixed several semicolon detection bugs that gave false positives

## 0.1.2 - 2/1/25

- Fixed a few more semicolon detection bugs

## 0.2.0 - 2/1/25

- Added a new setting: force-semicolon.lintType for deciding if VS Code should give an error, warning, or info dialogue (default is error)
- ignore and ignore-all quick fixes

## 0.2.1 - 2/1/25

- Fixed a bug affecting .property() lines of code

## 0.2.2 - 2/1/25

- Bug fix affecting chained promises
- Updated documentation

## 0.2.3 - 2/2/25

- Bug fix affecting lines ending in `[`
- Bug fix affecting multiline comments

## 0.3.0 - 2/4/25

- Complete overhaul of verification system.
    - We switched over from line-based and text-based scanning to AST-based scanning. This not only improves accuracy, it allows the extension to scan single-line files and accurately find incorrect/missing semicolons.
- New feature: Unnecessary Semicolon: detects if you put a semicolon after an if statement, function declaration, etc (like a psychopath)
- You can also now turn off Missing Semicolon and Unnecessasy Semicolon in settings

# Is this perfect?

No! This project may give false positives for several scenarios, because I can't test everything! Any contribution is greatly appreciated.