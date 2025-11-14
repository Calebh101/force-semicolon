"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const parser_1 = require("@babel/parser");
const traverse_1 = __importDefault(require("@babel/traverse"));
const core_1 = __importDefault(require("@babel/core"));
var debug = process.env.DEBUG !== null;
var html = false;
var allowFileAction = false;
var defaultSeverity = 'error';
var diagnosticSource = 'force-semicolon';
var noSemicolonMessage = "Missing or invalid semicolon.";
var unnecessarySemicolonMessage = 'Unnecessary semicolon.';
var extraSemicolonMessage = 'Extra semicolon.';
var allowedLanguages = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'html'];
var defaultReport = { "0": [], "-1": [] };
var report = defaultReport;
function print(input, attachment) {
    if (debug) {
        console.log("force-semicolon: log: " + input, attachment ?? 0);
    }
}
function output(input, attachment) {
    console.log("force-semicolon: output: " + input, attachment ?? 0);
}
function warn(input, attachment) {
    if (debug) {
        console.warn("force-semicolon: warn: " + input, attachment ?? -1);
    }
}
function printReport(file, report) {
    console.log("force-semicolon: report: report is ready (file: " + file + ")");
    Object.keys(report).slice(0, 100).forEach(key => console.log(key, report[key]));
}
function error(input, attachment) {
    console.error("force-semicolon: error: " + input, attachment ?? -1);
}
function action(input, attachment) {
    if (debug) {
        console.log("force-semicolon: action: " + input, attachment ?? 0);
    }
}
function extractText(document) {
    var text = document.getText();
    if (document.languageId === 'html') {
        if (!html) {
            return null;
        }
        var htmlS = text;
        var jsRegex = /<script.*?>([\s\S]*?)<\/script>/g;
        var matches;
        text = '// force-semicolon auto generated file\n';
        while ((matches = jsRegex.exec(htmlS)) !== null) {
            text += matches[1];
        }
    }
    return text;
}
function parseAst(document) {
    try {
        const text = extractText(document);
        if (!text) {
            print("text was null: " + text);
            return null;
        }
        const ast = (0, parser_1.parse)(text, {
            sourceType: "module",
            ranges: true,
            plugins: ["jsx", "typescript"],
            errorRecovery: true,
            allowReturnOutsideFunction: true,
        });
        return ast;
    }
    catch (e) {
        warn("error with parsing: " + e);
        return null;
    }
}
function isValidCode(code) {
    try {
        core_1.default.parseSync(code);
        return true;
    }
    catch (e) {
        return false;
    }
}
function handle(index, text, document) {
    var diagnosticsList = [];
    var statements = [];
    var ast = parseAst(document);
    if (!ast) {
        return { diagnostics: [] };
    }
    const comments = (ast.comments.map((comment) => comment.value)).join(' ');
    if (comments.includes('force-semicolon: ignore-all')) {
        addReport(-1, 'comment.action.ignore-all');
        return {
            diagnostics: [],
            comments: comments,
        };
    }
    (0, traverse_1.default)(ast, {
        enter(path) {
            var detectedResult = 0;
            var node = path.node;
            if (!node.loc || !node.loc.end) {
                error("invalid node location: " + node.loc);
                return;
            }
            var comments = node.leadingComments ?? [];
            if (comments.length > 0) {
                const comment = comments[comments.length - 1];
                if (comment.value.includes('force-semicolon: ignore')) {
                    detectedResult = -1;
                }
            }
            if (detectedResult >= 0) {
                var isExpressionStatement = path.isExpressionStatement(); // Is expression
                var isVariableDeclaration = path.isVariableDeclaration(); // If declaring a variable
                var isReturnStatement = path.isReturnStatement(); // If this is a return statement
                var isIfStatement = path.isIfStatement(); // If this is an if block
                var isElseStatement = (path.parentPath?.isIfStatement() ?? false) && path.key === "alternate"; // If this is an else block, connected to an if block
                var isForStatement = path.isForStatement(); // If this is a for loop
                var isWhileStatement = path.isWhileStatement(); // If this is a while loop
                var isDoWhileStatement = path.isDoWhileStatement(); // If this is a do while loop
                var isSwitchStatement = path.isSwitchStatement(); // If this is a switch block
                var isFunctionDeclaration = path.isFunctionDeclaration(); // If this declares a function
                var isFunctionExpression = path.isFunctionExpression(); // If this declares a function, but as an expression
                var isArrowFunctionExpression = path.isArrowFunctionExpression(); // If this is a function expression
                var isTryStatement = path.isTryStatement(); // If this is a try block
                var isThrowStatement = path.isThrowStatement(); // If this is a throw statement
                var isImportDeclaration = path.isImportDeclaration(); // If this is an import statement
                var isClassDeclaration = path.isClassDeclaration(); // If we're declaring a class
                var isClassMethod = path.isClassMethod(); // If this is a method inside a class
                var isExportDeclaration = path.isExportDeclaration(); // If this is an export
                var isExportNamedDeclaration = path.isExportNamedDeclaration(); // If this is a named export
                var isExportDefaultDeclaration = path.isExportDefaultDeclaration(); // If this is a default export
                var isCallExpression = path.isCallExpression(); // If we're calling a function
                var isForInStatement = path.isForInStatement(); // If this is a for in block
                var isForOfStatement = path.isForOfStatement(); // If this is a for of block
                var isObjectProperty = path.node.type === 'ObjectProperty'; // If this is a key/value pair in a JSON object
                var isInterfaceDeclaration = path.node.type === 'TSInterfaceDeclaration' || path.node.declaration?.type === 'TSInterfaceDeclaration'; // If this is declaring an interface
                var isInLoopHead = path.findParent((parent) => isVariableDeclaration && (parent.isForStatement() || parent.isForOfStatement() || parent.isForInStatement()) && path.key === "left"); // If we're in a loop head, like the 'int i = 0; ...' in a for block
                var isInObjectProperty = path.findParent((parent) => parent.isObjectProperty()); // If we're in an object property, see a few lines above
                var isAsyncFunctionExpression = isFunctionExpression && path.node.async; // If we're in an asynchronous function expression
                var isFunctionArgument = (path.isFunctionExpression() || path.isArrowFunctionExpression()) && path.parentPath?.isCallExpression() && path.key !== "callee"; // If we're an argument in a function
                var isFunctionStatement = isIfStatement || isForStatement || isWhileStatement || isDoWhileStatement || isForInStatement || isForOfStatement; // Badly named, but if we're any of these block types
                var isFunctionExport = (path.isExportNamedDeclaration() || path.isExportDefaultDeclaration()) && (path.node.declaration?.type === 'FunctionDeclaration' || path.node.declaration?.type === 'FunctionExpression' || path.node.declaration?.type === 'ArrowFunctionExpression' || path.node.expression?.type === 'FunctionExpression' || path.node.expression?.type === 'ArrowFunctionExpression'); // If this is a function we're exporting
                var isSingleStatement = isFunctionStatement && !path.node.consequent?.body && !path.node.alternate?.body; // If this is just a braceless block statement
                var { line, column } = node.loc.end;
                var lineM = line - 1;
                var columnM = column - 1;
                var columnP = column + 1;
                if (lineM <= 0)
                    lineM = 0;
                if (columnM <= 0)
                    columnM = 0;
                if (((isExpressionStatement ||
                    isVariableDeclaration ||
                    isReturnStatement ||
                    isFunctionExpression ||
                    isDoWhileStatement ||
                    isThrowStatement ||
                    isImportDeclaration ||
                    isExportDeclaration) && !(isVariableDeclaration &&
                    isInLoopHead) &&
                    !isArrowFunctionExpression &&
                    !isFunctionArgument &&
                    !isFunctionExport) &&
                    !isInterfaceDeclaration &&
                    !isInObjectProperty) {
                    detectedResult = 1; // Missing semicolon
                }
                else if ((isFunctionStatement ||
                    isFunctionDeclaration ||
                    isElseStatement ||
                    isTryStatement ||
                    isClassDeclaration ||
                    isClassMethod ||
                    isInterfaceDeclaration) &&
                    !(isVariableDeclaration &&
                        isInLoopHead) &&
                    !isArrowFunctionExpression &&
                    !isSingleStatement &&
                    !(isExportDeclaration && isClassDeclaration)) {
                    detectedResult = 2; // Extra semicolon
                }
                else {
                    detectedResult = 0; // Nothing detected! Woo
                }
                const start = new vscode.Position(lineM, columnP);
                const end = new vscode.Position(lineM, columnM);
                function toMask(flags) {
                    let mask = 0;
                    let bit = 0;
                    for (const key of Object.keys(flags)) {
                        if (flags[key])
                            mask |= (1 << bit);
                        bit++;
                    }
                    return mask;
                }
                statements.push({
                    mode: detectedResult,
                    type: node.type,
                    start: start,
                    end: end,
                    comments: comments,
                    flags: toMask({
                        isExpressionStatement,
                        isVariableDeclaration,
                        isReturnStatement,
                        isIfStatement,
                        isForStatement,
                        isWhileStatement,
                        isDoWhileStatement,
                        isSwitchStatement,
                        isFunctionDeclaration,
                        isFunctionExpression,
                        isTryStatement,
                        isInLoopHead,
                        isInObjectProperty,
                        isThrowStatement,
                        isImportDeclaration,
                        isExportDeclaration,
                        isExportDefaultDeclaration,
                        isExportNamedDeclaration,
                        isClassDeclaration,
                        isClassMethod,
                        isAsyncFunctionExpression,
                        isCallExpression,
                        isFunctionArgument,
                        isForOfStatement,
                        isForInStatement,
                        isSingleStatement,
                        isFunctionStatement,
                        isElseStatement,
                        isFunctionExport,
                        isObjectProperty,
                    }),
                });
            }
        },
    });
    for (let i = 0; i < statements.length; i++) {
        const statement = statements[i];
        const start = statement.start;
        const end = statement.end;
        const range = new vscode.Range(start, end);
        const text = document.getText(range);
        if (statement.mode === 1) {
            if (text.includes(';;')) {
                const diagnostic = new vscode.Diagnostic(range, extraSemicolonMessage);
                diagnosticsList.push({ diagnostic: diagnostic, mode: 3 });
                addReport(i, 'statements.statement.diagnostic.add.1.1', { 'text': text, 'range': range, 'mode': 1, "statement": statement });
            }
            else {
                if (text.includes(';')) {
                    continue;
                }
                const diagnostic = new vscode.Diagnostic(range, noSemicolonMessage);
                diagnosticsList.push({ diagnostic: diagnostic, mode: 1 });
                addReport(i, 'statements.statement.diagnostic.add.1.0', { 'text': text, 'range': range, 'mode': 1, "statement": statement });
            }
        }
        else if (statement.mode === 2) {
            if (!text.includes(';')) {
                continue;
            }
            const diagnostic = new vscode.Diagnostic(range, unnecessarySemicolonMessage);
            diagnosticsList.push({ diagnostic: diagnostic, mode: 2 });
            addReport(i, 'statements.statement.diagnostic.add.2.0', { 'text': text, 'range': range, 'mode': 2, "statement": statement });
        }
    }
    return {
        diagnostics: diagnosticsList,
        comments: comments,
    };
}
function getSeverity(input) {
    switch (input) {
        case 'Info':
        case 'info': return vscode.DiagnosticSeverity.Information;
        case 'Hint':
        case 'hint': return vscode.DiagnosticSeverity.Hint;
        case 'Warning':
        case 'warn': return vscode.DiagnosticSeverity.Warning;
        case 'Error':
        case 'error': return vscode.DiagnosticSeverity.Error;
        case 'Off':
        case 'off': return null;
        default:
            error("unknown severity: " + input);
            return getSeverity(defaultSeverity);
    }
}
function activate(context) {
    print('force-semicolon is active (debug: ' + debug + ')');
    const diagnostics = vscode.languages.createDiagnosticCollection('a');
    const editor = vscode.window.activeTextEditor;
    context.subscriptions.push(diagnostics);
    if (editor) {
        action('extension.active');
        updateDiagnostics(editor.document, diagnostics);
        analyzeAll(diagnostics);
    }
    vscode.workspace.onDidChangeTextDocument(event => {
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            updateDiagnostics(editor.document, diagnostics);
        }
    });
    vscode.workspace.onDidOpenTextDocument((document) => {
        action('workspace.onDidOpenTextDocument');
        updateDiagnostics(document, diagnostics);
    });
    vscode.window.onDidChangeActiveTextEditor(editor => {
        action('window.onDidChangeActivateTextEditor');
        if (editor) {
            updateDiagnostics(editor.document, diagnostics);
        }
    });
    vscode.workspace.onDidCreateFiles((event) => {
        fileAction('workspace.onDidCreateFiles', diagnostics);
    });
    vscode.workspace.onDidRenameFiles((event) => {
        fileAction('workspace.onDidRenameFiles', diagnostics);
    });
    context.subscriptions.push(vscode.commands.registerCommand('force-semicolon.analyze.all', () => {
        action('command.activate.analyze.all');
        analyzeAll(diagnostics);
    }));
    const fixCommands = [
        "force-semicolon.fix.current.missing",
        "force-semicolon.fix.current.unnecessary",
        "force-semicolon.fix.current.extra",
        "force-semicolon.fix.current.all",
        "force-semicolon.fix.open.missing",
        "force-semicolon.fix.open.unnecessary",
        "force-semicolon.fix.open.extra",
        "force-semicolon.fix.open.all",
        "force-semicolon.fix.all.missing",
        "force-semicolon.fix.all.unnecessary",
        "force-semicolon.fix.all.extra",
        "force-semicolon.fix.all.all",
    ];
    fixCommands.forEach(command => {
        context.subscriptions.push(vscode.commands.registerCommand(command, async () => {
            action(`command.activate.${command}`);
            command = command.replaceAll('force-semicolon.fix.', '');
            const subcommands = command.split('.');
            const document = subcommands[0];
            const type = subcommands[1];
            const documents = await getAllDocuments(document);
            if (documents === null) {
                warn("command " + command + " stopped: documents was null");
                return;
            }
            documents.forEach(document => {
                if (type === "all") {
                    fixDocument(document, "missing-semicolon");
                    fixDocument(document, "unnecessary-semicolon");
                    fixDocument(document, "extra-semicolon");
                }
                else {
                    fixDocument(document, type + '-semicolon');
                }
            });
        }));
    });
    allowedLanguages.forEach((language) => {
        vscode.languages.registerCodeActionsProvider({ language: language, scheme: 'file' }, new SemicolonCodeActionProvider());
    });
}
async function getAllDocuments(type) {
    switch (type) {
        case 'current':
            return vscode.window.activeTextEditor ? [vscode.window.activeTextEditor.document] : null;
        case 'open':
            return vscode.window.tabGroups.all.flatMap(({ tabs }) => tabs.map(tab => {
                let uri;
                if (tab.input instanceof vscode.TabInputText || tab.input instanceof vscode.TabInputNotebook) {
                    uri = tab.input.uri;
                }
                else if (tab.input instanceof vscode.TabInputTextDiff || tab.input instanceof vscode.TabInputNotebookDiff) {
                    uri = tab.input.original;
                }
                if (uri) {
                    const document = vscode.workspace.textDocuments.find(doc => doc.uri.toString() === uri.toString());
                    if (document) {
                        return document;
                    }
                }
                return null;
            })).filter(Boolean).filter(item => item !== null);
        case 'all':
            const files = await vscode.workspace.findFiles('**/*');
            const documentPromises = files.map(file => vscode.workspace.openTextDocument(file));
            const documents = await Promise.all(documentPromises);
            return documents;
        default:
            error("invalid document type: " + type);
            return null;
    }
}
function fileAction(name, diagnostics) {
    action(name + " (fileAction: " + allowFileAction + ")");
    if (allowFileAction) {
        analyzeAll(diagnostics);
    }
}
function analyzeAll(diagnostics) {
    vscode.workspace.findFiles('**/*.{js,ts}', '**/node_modules/**').then(files => {
        files.forEach(fileUri => {
            vscode.workspace.openTextDocument(fileUri).then(document => {
                updateDiagnostics(document, diagnostics);
            });
        });
    });
}
function addReport(index, type, input) {
    if (!debug) {
        return;
    }
    var generated = {
        "index": index,
        "type": type,
        "value": input,
    };
    if (index <= -1) {
        report[`${index}`].push(generated);
    }
    else {
        report[`${index}`] = generated;
    }
}
function updateDiagnostics(document, diagnostics) {
    if (!allowedLanguages.includes(document.languageId)) {
        return;
    }
    report = defaultReport;
    report["i"] = {
        "document": document.uri.fsPath,
        "language": document.languageId,
        "mode": 2,
    };
    var config = vscode.workspace.getConfiguration('force-semicolon');
    var diagnosticsList = [];
    var ignoreAll = false;
    var missingSeverity = config.get('missingSemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var unnecessarySeverity = config.get('unnecessarySemicolonLintType', defaultSeverity) ?? defaultSeverity;
    var extraSeverity = config.get('extraSemicolonLintType', defaultSeverity) ?? defaultSeverity;
    const result = handle(-1, "", document);
    diagnosticsList = result.diagnostics;
    var diagnosticsS = [];
    diagnosticsList.forEach((item, index) => {
        var detectedResult = 0;
        var diagnostic = item.diagnostic;
        var off = 'Off';
        var code = 'unknown';
        if (item.mode === 1) {
            detectedResult = 1;
        }
        else if (item.mode === 2) {
            detectedResult = 2;
        }
        else if (item.mode === 3) {
            detectedResult = 3;
        }
        else {
            error("unknown diagnostic.mode: " + item.mode);
            detectedResult = 0;
        }
        switch (detectedResult) {
            case 0:
                diagnostic.severity = getSeverity(defaultSeverity);
                break;
            case 1:
                if (missingSeverity === off) {
                    detectedResult = -1;
                }
                diagnostic.severity = getSeverity(missingSeverity);
                code = 'missing-semicolon';
                break;
            case 2:
                if (unnecessarySeverity === off) {
                    detectedResult = -1;
                }
                diagnostic.severity = getSeverity(unnecessarySeverity);
                code = 'unnecessary-semicolon';
                break;
            case 3:
                if (extraSeverity === off) {
                    detectedResult = -1;
                }
                diagnostic.severity = getSeverity(extraSeverity);
                code = 'extra-semicolon';
                break;
            default:
                error("unknown detectedResult: " + detectedResult);
                detectedResult = -1;
        }
        if (detectedResult >= 0) {
            diagnostic.code = code;
            diagnostic.source = diagnosticSource;
            diagnosticsS.push(diagnostic);
        }
    });
    if (ignoreAll) {
        addReport(-1, 'diagnostics.set', 'ignore');
        diagnostics.set(document.uri, []);
    }
    else {
        addReport(-1, 'diagnostics.set', 'set');
        diagnostics.set(document.uri, diagnosticsS);
    }
    if (config.get('debugMode', false) ?? false) {
        printReport(document.uri.fsPath, report);
    }
}
async function fixDocument(document, type) {
    const name = document.fileName;
    print("fix document (" + name + "): start: on type " + type);
    const diagnostics = vscode.languages.getDiagnostics(document.uri);
    print(JSON.stringify(diagnostics));
    const relevantDiagnostics = diagnostics.filter(d => d.code === type);
    print(JSON.stringify(relevantDiagnostics));
    if (relevantDiagnostics.length === 0) {
        print("fix document (" + name + "): stop: not enough diagnostics");
        return;
    }
    const edit = new vscode.WorkspaceEdit();
    relevantDiagnostics.forEach(diagnostic => {
        print("fix document (" + name + "): fix: " + type);
        switch (diagnostic.code) {
            case "missing-semicolon":
                const positionS = new vscode.Position(diagnostic.range.end.line, diagnostic.range.end.character);
                edit.insert(document.uri, positionS, ';');
                print("fix document (" + name + "): success: fix missing-semicolon");
                break;
            case "unnecessary-semicolon":
            case "extra-semicolon":
                const positionA = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                const positionB = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2);
                const range = new vscode.Range(positionA, positionB);
                edit.delete(document.uri, range);
                print("fix document (" + name + "): success: fix unnecessary-semicolon/extra-semicolon");
                break;
            default:
                error("unknown diagnostic type: " + type);
                return;
        }
    });
    print("fix document (" + name + "): success: complete");
    await vscode.workspace.applyEdit(edit);
}
class SemicolonCodeActionProvider {
    provideCodeActions(document, range, context, token) {
        const diagnostics = context.diagnostics.filter(d => d.source === diagnosticSource);
        var fixes = [];
        if (diagnostics.length === 0) {
            return [];
        }
        diagnostics.forEach(diagnostic => {
            switch (diagnostic.code) {
                case "missing-semicolon":
                    // addFix
                    const addFix = new vscode.CodeAction('Add semicolon', vscode.CodeActionKind.QuickFix);
                    const position = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    addFix.edit = new vscode.WorkspaceEdit();
                    addFix.edit.insert(document.uri, position, ';');
                    addFix.diagnostics = [diagnostic];
                    fixes.push(addFix);
                    break;
                case "unnecessary-semicolon":
                    // removeFix
                    const removeFixU = new vscode.CodeAction('Remove unnecessary semicolon', vscode.CodeActionKind.QuickFix);
                    const positionA = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    const range = new vscode.Range(positionA, new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2));
                    removeFixU.edit = new vscode.WorkspaceEdit();
                    removeFixU.edit.delete(document.uri, range);
                    removeFixU.diagnostics = [diagnostic];
                    fixes.push(removeFixU);
                    break;
                case "extra-semicolon":
                    // removeFix
                    const removeFixE = new vscode.CodeAction('Remove extra semicolon', vscode.CodeActionKind.QuickFix);
                    const positionB = new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 1);
                    const rangeE = new vscode.Range(positionB, new vscode.Position(diagnostic.range.end.line, diagnostic.range.start.character + 2));
                    removeFixE.edit = new vscode.WorkspaceEdit();
                    removeFixE.edit.delete(document.uri, rangeE);
                    removeFixE.diagnostics = [diagnostic];
                    fixes.push(removeFixE);
                    break;
                default:
                    break;
            }
        });
        // initialize fixes
        const ignoreFix = new vscode.CodeAction('Ignore this line', vscode.CodeActionKind.QuickFix);
        const ignoreAllFix = new vscode.CodeAction('Ignore this file', vscode.CodeActionKind.QuickFix);
        const lineText = document.lineAt(range.start.line).text;
        const trimmedText = lineText.trimEnd();
        const spaces = getLeadingSpaces(lineText);
        if (trimmedText.length <= 0) {
            return [];
        }
        // ignoreFix
        const pos = new vscode.Position(range.start.line, 0);
        ignoreFix.edit = new vscode.WorkspaceEdit();
        ignoreFix.edit.insert(document.uri, pos, ' '.repeat(spaces) + '// force-semicolon: ignore\n');
        fixes.push(ignoreFix);
        // ignoreAllFix
        const posA = new vscode.Position(0, 0);
        ignoreAllFix.edit = new vscode.WorkspaceEdit();
        ignoreAllFix.edit.insert(document.uri, posA, '// force-semicolon: ignore-all\n');
        fixes.push(ignoreAllFix);
        return fixes;
    }
}
function getLeadingSpaces(lineText) {
    const match = lineText.match(/^(\s*)/);
    return match ? match[0].length : 0;
}
function deactivate() {
    action('extension.deactive');
}
//# sourceMappingURL=extension.js.map