/**
 * util-deps.js - The parser for dependencies
 * ref: tests/research/parse-dependencies/test.html
 * ref: https://github.com/seajs/crequire
 */

function parseDependencies(s) {
  // 不存在'require'，不需要解析依赖
  if(s.indexOf('require') == -1) {
    return []
  }
  // isReg为1时，代表该行接下来允许直接出现正则表达式
  var index = 0, peek, length = s.length, isReg = 1, modName = 0, res = []
  var parentheseState = 0, parentheseStack = []
  var braceState, braceStack = [], isReturn
  while(index < length) {
    readch()
    if(isBlank()) {
      if(isReturn && (peek == '\n' || peek == '\r')) {
        braceState = 0
        isReturn = 0
      }
    }
    else if(isQuote()) {
      dealQuote()
      isReg = 1
      isReturn = 0
      braceState = 0
    }
    else if(peek == '/') {
      readch()
      if(peek == '/') {
        // '// 注释'
        index = s.indexOf('\n', index)
        if(index == -1) {
          index = s.length
        }
      }
      else if(peek == '*') {
        // '/*  */ 注释''
        var i = s.indexOf('\n', index)
        index = s.indexOf('*/', index)
        if(index == -1) {
          index = length
        }
        else {
          // 注释结束的位置 + 1
          index += 2
        }
        if(isReturn && i != -1 && i < index) {
          braceState = 0
          isReturn = 0
        }
      }
      else if(isReg) {
        // /test/ 正则表达式
        dealReg()
        // 接下来不允许直接出现正则表达式
        isReg = 0
        isReturn = 0
        braceState = 0
      }
      else {
        // '/reg/ / /reg/'
        // '5 / /reg/'
        // 当前可能是正则表达式，重新执行上一步操作
        index--
        isReg = 1
        isReturn = 0
        braceState = 1
      }
    }
    else if(isWord()) {
      dealWord()
    }
    else if(isNumber()) {
      dealNumber()
      isReturn = 0
      braceState = 0
    }
    else if(peek == '(') {
      // 如果上一次查找到了'if','for'这类的词，parentheseState值为1
      // 否则为0
      parentheseStack.push(parentheseState)
      isReg = 1
      isReturn = 0
      // 接下来如果是'{'，说明是进入了右侧对象
      braceState = 1
    }
    else if(peek == ')') {
      // if(1) /reg/
      // 如果'()'以'if','for'这类的词开始，则此时isReg的值为1，因为该行还是允许直接出现正则表达式
      // 否则为0
      isReg = parentheseStack.pop()
      isReturn = 0
      braceState = 0
    }
    else if(peek == '{') {
      if(isReturn) {
        // return接下来就是'{'，说明是进入了右侧对象
        braceState = 1
      }
      // 'while () {}' 之后可以直接出现正则表达式
      // 'if () {}' 之后可以直接出现正则表达式
      // 'function () {}' 之后可以直接出现正则表达式
      braceStack.push(braceState)
      isReturn = 0
      isReg = 1
    }
    else if(peek == '}') {
      braceState = braceStack.pop()
      // braceState为1说明之前是右侧对象，对象之后不能直接出现正则表达式
      isReg = !braceState
      isReturn = 0
    }
    else {
      var next = s.charAt(index)
      if(peek == ';') {
        braceState = 0
      }
      else if(peek == '-' && next == '-'
        || peek == '+' && next == '+'
        || peek == '=' && next == '>') {
        braceState = 0
        index++
      }
      else {
        braceState = 1
      }
      isReg = peek != ']'
      isReturn = 0
    }
  }
  return res
  function readch() {
    peek = s.charAt(index++)
  }
  function isBlank() {
    return /\s/.test(peek)
  }
  function isQuote() {
    return peek == '"' || peek == "'"
  }
  function dealQuote() {
    var start = index
    var c = peek
    var end = s.indexOf(c, start)
    if(end == -1) {
      index = length
    }
    else if(s.charAt(end - 1) != '\\') {
      index = end + 1
    }
    else {
      while(index < length) {
        readch()
        if(peek == '\\') {
          index++
        }
        else if(peek == c) {
          break
        }
      }
    }
    // 上一次操作dealWord断定了使用了require
    if(modName) {
      //maybe substring is faster  than slice .
      res.push(s.substring(start, index - 1))
      modName = 0
    }
  }
  function dealReg() {
    index--
    while(index < length) {
      readch()
      if(peek == '\\') {
        // 已转义下一个字符无论是什么都跳过
        index++
      }
      else if(peek == '/') {
        // 已到正则表达式的结尾
        break
      }
      else if(peek == '[') {
        while(index < length) {
          readch()
          if(peek == '\\') {
            index++
          }
          else if(peek == ']') {
            break
          }
        }
      }
    }
  }
  function isWord() {
    return /[a-z_$]/i.test(peek)
  }
  function dealWord() {
    var s2 = s.slice(index - 1)
    var r = /^[\w$]+/.exec(s2)[0]
    parentheseState = {
      'if': 1,
      'for': 1,
      'while': 1,
      'with': 1
    }[r]
    isReg = {
      'break': 1,
      'case': 1,
      'continue': 1,
      'debugger': 1,
      'delete': 1,
      'do': 1,
      'else': 1,
      'false': 1,
      'if': 1,
      'in': 1,
      'instanceof': 1,
      'return': 1,
      'typeof': 1,
      'void': 1
    }[r]
    // 下面的值是return第一个可能返回的值
    isReturn = r == 'return'
    // 如果接下来是'{'，说明是进入了右侧对象
    braceState = {
      'instanceof': 1,
      'delete': 1,
      'void': 1,
      'typeof': 1,
      'return': 1
    }.hasOwnProperty(r)
    modName = /^require\s*(?:\/\*[\s\S]*?\*\/\s*)?\(\s*(['"]).+?\1\s*[),]/.test(s2)
    if(modName) {
      // require /*  */ ( 'modName')
      r = /^require\s*(?:\/\*[\s\S]*?\*\/\s*)?\(\s*['"]/.exec(s2)[0]
      // 下一次从引号开始
      // -2理由是开始的'r'占一位，结尾的引号也占一位
      index += r.length - 2
    }
    else {
      index += /^[\w$]+(?:\s*\.\s*[\w$]+)*/.exec(s2)[0].length - 1
    }
  }
  function isNumber() {
    return /\d/.test(peek)
      || peek == '.' && /\d/.test(s.charAt(index))
  }
  function dealNumber() {
    var s2 = s.slice(index - 1)
    var r
    if(peek == '.') {
      r = /^\.\d+(?:E[+-]?\d*)?\s*/i.exec(s2)[0]
    }
    else if(/^0x[\da-f]*/i.test(s2)) {
      r = /^0x[\da-f]*\s*/i.exec(s2)[0]
    }
    else {
      r = /^\d+\.?\d*(?:E[+-]?\d*)?\s*/i.exec(s2)[0]
    }
    index += r.length - 1
    // 数字之后的'/'只能是除号，不可能是正则表达式的开始
    isReg = 0
  }
}
