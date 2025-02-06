# What is this?

## Summary

This extension helps you use semicolons correctly in JavaScript and TypeScript. It uses ASTs to get a map of your code, and then will parse your code and figure out if the statement is supposed to have a semicolon, not supposed to have a semicolon, or is not a statement. If it is not supposed to have a semicolon, then it makes sure there are none at the end. If there is, it will tell you. If it is supposed to have a semicolon, it detects if there is a semicolon present. If there isn't, then it tells you. If there is, it makes sure there is not more than one (if there is, it'll tell you).

## Features

- Missing Semicolon: detects semicolons that are missing from the end of a statement.
- Unnecessary Semicolon: detects semicolons wrongly used at the end of function declarations, if statements, etc.
- Extra Semicolon: detects if you have more than one semicolon at the end of a statement.

This extension is in beta, so be aware that it might not always be perfect. Expect a lot of small releases until this extension exits beta.

# How to Use

## Comments

### Ignore a statement

To ignore a statement: Simply insert this comment above the line, like so:

```javascript
// force-semicolon: ignore
function("function without a semicolon")
```

This will ignore the statement directly below the comment.

**Tip**: Ignore statements have to be directly before the expression. For example:

```javascript
if (condition) return;
// force-semicolon: ignore
else console.log("test")
```

Even with the `ignore` there, it will still give a Missing Semicolon error for `console.log("test")`. This is because the `force-semicolon: ignore` comment is actually ignoring the `else`. Because the `else` doesn't use semicolons, this cancels out the `force-semicolon: ignore` action.

To ignore the statement inside the `else`, you will need to put the `force-semicolon: ignore` directly before the expression. For example:

```javascript
if (condition) return;
else /* force-semicolon: ignore */ console.log("test")
```

This will successfully ignore `console.log("test")`.

### Ignore a file

To ignore a file: Simply insert this comment anywhere in the file, like so:

```javascript
// force-semicolon: ignore-all
function("function without a semicolon")
```

This will ignore all semicolon errors in the entire file.

## Settings

- force-semicolon.missingSemicolonLintType: setting that decides if VS Code should give an error, warning, or info dialogue for missing semicolons
    - Options:
        - Error: red line and notification
        - Warning: yellow line and notification
        - Info: blue line
        - Off: no line
    - Default: Error

- force-semicolon.unnecessarySemicolonLintType: setting that decides if VS Code should give an error, warning, or info dialogue for unnecessary semicolons (semicolons after function declarations, if statements, etc.)
    - Options:
        - Error: red line and notification
        - Warning: yellow line and notification
        - Info: blue line
        - Off: no line
    - Default: Error

- force-semicolon.extraSemicolonLintType: setting that decides if VS Code should give an error, warning, or info dialogue for extra semicolons after statements
    - Options:
        - Error: red line and notification
        - Warning: yellow line and notification
        - Info: blue line
        - Off: no line
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

## 0.3.0 - 2/5/25

- Complete overhaul of verification system
    - We switched over from line-based and text-based scanning to AST-based scanning. This not only improves accuracy, it allows the extension to scan single-line files and accurately find incorrect/missing semicolons.
- New feature: Unnecessary Semicolon: detects and warns you if you put a semicolon after an if statement, function declaration, etc (like a psychopath)
- New feature: Extra Semicolon: detects and warns you if you put an extra semicolon at the end of a statement
- You can also now turn off Missing Semicolon, Unnecessasy Semicolon, and Extra Semicolon in VS Code settings

## 0.3.1 - 2/5/25

- Bug fix affecting callbacks
- Improved documentation

## 0.3.2 - 2/5/25

- Bug fix affecting callbacks

## 0.3.3 - 2/5/25

- Bug fix affecting callbacks (third in a row, that is impressive)
- Improved documentation
- Optimized extension

## 0.3.4 - 2/5/25

- Bug fix affecting if statements (and others that use this) that do not have braces
- Improved documentation

# Is this perfect?

No! This project may give false positives for several scenarios, because I can't test everything! Any contribution is greatly appreciated.

# Support

For feedback and support, email me at [calebh101dev@icloud.com](mailto:calebh101dev@icloud.com)