package projektni.praktikum.flysight.cityinfra

enum class TokenKind {
    Identifier,
    StringLiteral,
    Number,
    LeftBrace,
    RightBrace,
    LeftParen,
    RightParen,
    Comma,
    Semicolon,
    End,
}

data class Token(
    val kind: TokenKind,
    val lexeme: String,
    val line: Int,
    val column: Int,
)

class LexException(message: String) : RuntimeException(message)

class Lexer(private val source: String) {
    private var index = 0
    private var line = 1
    private var column = 1

    fun tokenize(): List<Token> {
        val tokens = mutableListOf<Token>()
        while (!isAtEnd()) {
            skipWhitespaceAndComments()
            if (isAtEnd()) break

            val startLine = line
            val startColumn = column
            val char = peek()

            val token = when {
                char == '"' -> stringToken(startLine, startColumn)
                char == '-' && peekNext()?.isDigit() == true -> numberToken(startLine, startColumn)
                char.isDigit() -> numberToken(startLine, startColumn)
                char.isIdentifierStart() -> identifierToken(startLine, startColumn)
                else -> symbolToken(startLine, startColumn)
            }

            tokens.add(token)
        }
        tokens.add(Token(TokenKind.End, "", line, column))
        return tokens
    }

    private fun skipWhitespaceAndComments() {
        var advanced: Boolean
        do {
            advanced = false
            while (!isAtEnd() && peek().isWhitespace()) {
                advance()
                advanced = true
            }
            if (!isAtEnd() && peek() == '#') {
                while (!isAtEnd() && peek() != '\n') advance()
                advanced = true
            }
            if (!isAtEnd() && peek() == '/' && peekNext() == '/') {
                while (!isAtEnd() && peek() != '\n') advance()
                advanced = true
            }
        } while (advanced)
    }

    private fun stringToken(startLine: Int, startColumn: Int): Token {
        advance()
        val builder = StringBuilder()
        while (!isAtEnd() && peek() != '"') {
            val char = advance()
            if (char == '\n') {
                throw LexException("Unterminated string at $startLine:$startColumn")
            }
            if (char == '\\') {
                if (isAtEnd()) throw LexException("Unterminated escape at $line:$column")
                builder.append(
                    when (val escaped = advance()) {
                        '"' -> '"'
                        '\\' -> '\\'
                        'n' -> '\n'
                        't' -> '\t'
                        else -> escaped
                    },
                )
            } else {
                builder.append(char)
            }
        }
        if (isAtEnd()) throw LexException("Unterminated string at $startLine:$startColumn")
        advance()
        return Token(TokenKind.StringLiteral, builder.toString(), startLine, startColumn)
    }

    private fun numberToken(startLine: Int, startColumn: Int): Token {
        val builder = StringBuilder()
        if (peek() == '-') builder.append(advance())
        while (!isAtEnd() && peek().isDigit()) builder.append(advance())
        if (!isAtEnd() && peek() == '.' && peekNext()?.isDigit() == true) {
            builder.append(advance())
            while (!isAtEnd() && peek().isDigit()) builder.append(advance())
        }
        return Token(TokenKind.Number, builder.toString(), startLine, startColumn)
    }

    private fun identifierToken(startLine: Int, startColumn: Int): Token {
        val builder = StringBuilder()
        while (!isAtEnd() && peek().isIdentifierPart()) builder.append(advance())
        return Token(TokenKind.Identifier, builder.toString(), startLine, startColumn)
    }

    private fun symbolToken(startLine: Int, startColumn: Int): Token {
        val char = advance()
        val kind = when (char) {
            '{' -> TokenKind.LeftBrace
            '}' -> TokenKind.RightBrace
            '(' -> TokenKind.LeftParen
            ')' -> TokenKind.RightParen
            ',' -> TokenKind.Comma
            ';' -> TokenKind.Semicolon
            else -> throw LexException("Unexpected character '$char' at $startLine:$startColumn")
        }
        return Token(kind, char.toString(), startLine, startColumn)
    }

    private fun isAtEnd() = index >= source.length
    private fun peek() = source[index]
    private fun peekNext() = source.getOrNull(index + 1)

    private fun advance(): Char {
        val char = source[index++]
        if (char == '\n') {
            line++
            column = 1
        } else {
            column++
        }
        return char
    }

    private fun Char.isIdentifierStart(): Boolean = this == '_' || isLetter()
    private fun Char.isIdentifierPart(): Boolean = this == '_' || isLetterOrDigit()
}
