package projektni.praktikum.flysight.cityinfra

class ParseException(message: String) : RuntimeException(message)

class Parser(private val tokens: List<Token>) {
    private var index = 0

    fun parseProgram(): CityProgram {
        val city = parseCity()
        expect(TokenKind.End, "end of file")
        return city
    }

    private fun parseCity(): CityProgram {
        expectKeyword("city")
        val name = expectString()
        expect(TokenKind.LeftBrace, "{")
        val items = parseCityItems()
        expect(TokenKind.RightBrace, "}")
        return CityProgram(name, items)
    }

    private fun parseCityItems(): List<CityItem> {
        val items = mutableListOf<CityItem>()
        while (!check(TokenKind.RightBrace) && !check(TokenKind.End)) {
            items.add(parseCityItem())
        }
        return items
    }

    private fun parseCityItem(): CityItem =
        when (peek().lexeme) {
            "district" -> parseDistrict()
            "road" -> parseRoad()
            "building" -> parseBuilding()
            "park" -> parsePark()
            "water" -> parseWater()
            "utility" -> parseUtility()
            "stop" -> parseStop()
            "poi" -> parsePoi()
            "sensor" -> parseSensor()
            "zone" -> parseZone()
            "set" -> MetadataItem(parseMetadata())
            else -> error("city item")
        }

    private fun parseDistrict(): District {
        expectKeyword("district")
        val name = expectString()
        expect(TokenKind.LeftBrace, "{")
        val items = parseCityItems()
        expect(TokenKind.RightBrace, "}")
        return District(name, items)
    }

    private fun parseRoad(): Road {
        expectKeyword("road")
        val name = expectString()
        expectKeyword("type")
        val type = expectIdentifier()
        expectKeyword("speed")
        val speed = expectNumber()
        expect(TokenKind.LeftBrace, "{")
        val commands = parsePathCommands()
        val metadata = parseMetadataItems()
        expect(TokenKind.RightBrace, "}")
        expect(TokenKind.Semicolon, ";")
        return Road(name, type, speed, commands, metadata)
    }

    private fun parseBuilding(): Building {
        expectKeyword("building")
        val name = expectString()
        expectKeyword("floors")
        val floors = expectInteger()
        expectKeyword("use")
        val use = expectIdentifier()
        expect(TokenKind.LeftBrace, "{")
        val commands = parseAreaCommands()
        val metadata = parseMetadataItems()
        expect(TokenKind.RightBrace, "}")
        expect(TokenKind.Semicolon, ";")
        return Building(name, floors, use, commands, metadata)
    }

    private fun parsePark(): Park {
        expectKeyword("park")
        val name = expectString()
        expect(TokenKind.LeftBrace, "{")
        val commands = parseAreaCommands()
        val metadata = parseMetadataItems()
        expect(TokenKind.RightBrace, "}")
        expect(TokenKind.Semicolon, ";")
        return Park(name, commands, metadata)
    }

    private fun parseWater(): Water {
        expectKeyword("water")
        val name = expectString()
        expectKeyword("type")
        val type = expectIdentifier()
        expect(TokenKind.LeftBrace, "{")
        val commands = parsePathCommands()
        val metadata = parseMetadataItems()
        expect(TokenKind.RightBrace, "}")
        expect(TokenKind.Semicolon, ";")
        return Water(name, type, commands, metadata)
    }

    private fun parseUtility(): Utility {
        expectKeyword("utility")
        val name = expectString()
        expectKeyword("type")
        val type = expectIdentifier()
        expectKeyword("material")
        val material = expectIdentifier()
        expect(TokenKind.LeftBrace, "{")
        val commands = parsePathCommands()
        val metadata = parseMetadataItems()
        expect(TokenKind.RightBrace, "}")
        expect(TokenKind.Semicolon, ";")
        return Utility(name, type, material, commands, metadata)
    }

    private fun parseStop(): Stop {
        expectKeyword("stop")
        val name = expectString()
        expectKeyword("mode")
        val mode = expectIdentifier()
        expectKeyword("at")
        val at = parsePoint()
        expect(TokenKind.Semicolon, ";")
        return Stop(name, mode, at)
    }

    private fun parsePoi(): Poi {
        expectKeyword("poi")
        val name = expectString()
        expectKeyword("kind")
        val kind = expectIdentifier()
        expectKeyword("at")
        val at = parsePoint()
        expect(TokenKind.Semicolon, ";")
        return Poi(name, kind, at)
    }

    private fun parseSensor(): Sensor {
        expectKeyword("sensor")
        val name = expectString()
        expectKeyword("kind")
        val kind = expectIdentifier()
        expectKeyword("at")
        val at = parsePoint()
        val metadata = if (match(TokenKind.LeftBrace)) {
            val metadata = parseMetadataItems()
            expect(TokenKind.RightBrace, "}")
            metadata
        } else {
            emptyList()
        }
        expect(TokenKind.Semicolon, ";")
        return Sensor(name, kind, at, metadata)
    }

    private fun parseZone(): Zone {
        expectKeyword("zone")
        val name = expectString()
        expectKeyword("use")
        val use = expectIdentifier()
        expect(TokenKind.LeftBrace, "{")
        val commands = parseAreaCommands()
        val metadata = parseMetadataItems()
        expect(TokenKind.RightBrace, "}")
        expect(TokenKind.Semicolon, ";")
        return Zone(name, use, commands, metadata)
    }

    private fun parsePathCommands(): List<PathCommand> {
        val commands = mutableListOf<PathCommand>()
        while (peek().lexeme in setOf("line", "bend", "polyline")) {
            commands.add(parsePathCommand())
        }
        if (commands.isEmpty()) error("path command")
        return commands
    }

    private fun parsePathCommand(): PathCommand =
        when (peek().lexeme) {
            "line" -> parseLine()
            "bend" -> parseBend()
            "polyline" -> parsePolyline()
            else -> error("path command")
        }

    private fun parseAreaCommands(): List<AreaCommand> {
        val commands = mutableListOf<AreaCommand>()
        while (peek().lexeme in setOf("line", "bend", "box", "polygon", "circle")) {
            commands.add(parseAreaCommand())
        }
        if (commands.isEmpty()) error("area command")
        return commands
    }

    private fun parseAreaCommand(): AreaCommand =
        when (peek().lexeme) {
            "line" -> parseLine()
            "bend" -> parseBend()
            "box" -> parseBox()
            "polygon" -> parsePolygon()
            "circle" -> parseCircle()
            else -> error("area command")
        }

    private fun parseLine(): Line {
        expectKeyword("line")
        expect(TokenKind.LeftParen, "(")
        val start = parsePoint()
        expect(TokenKind.Comma, ",")
        val end = parsePoint()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Line(start, end)
    }

    private fun parseBend(): Bend {
        expectKeyword("bend")
        expect(TokenKind.LeftParen, "(")
        val start = parsePoint()
        expect(TokenKind.Comma, ",")
        val end = parsePoint()
        expect(TokenKind.Comma, ",")
        val angle = expectNumber()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Bend(start, end, angle)
    }

    private fun parseBox(): Box {
        expectKeyword("box")
        expect(TokenKind.LeftParen, "(")
        val first = parsePoint()
        expect(TokenKind.Comma, ",")
        val second = parsePoint()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Box(first, second)
    }

    private fun parsePolygon(): Polygon {
        expectKeyword("polygon")
        expect(TokenKind.LeftParen, "(")
        val points = parsePointList()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Polygon(points)
    }

    private fun parsePolyline(): Polyline {
        expectKeyword("polyline")
        expect(TokenKind.LeftParen, "(")
        val points = parsePointList()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Polyline(points)
    }

    private fun parseCircle(): Circle {
        expectKeyword("circle")
        expect(TokenKind.LeftParen, "(")
        val center = parsePoint()
        expect(TokenKind.Comma, ",")
        val radius = expectNumber()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Circle(center, radius)
    }

    private fun parseMetadataItems(): List<Metadata> {
        val metadata = mutableListOf<Metadata>()
        while (peek().lexeme == "set") {
            metadata.add(parseMetadata())
        }
        return metadata
    }

    private fun parseMetadata(): Metadata {
        expectKeyword("set")
        expect(TokenKind.LeftParen, "(")
        val key = expectString()
        expect(TokenKind.Comma, ",")
        val value = parseMetadataValue()
        expect(TokenKind.RightParen, ")")
        expect(TokenKind.Semicolon, ";")
        return Metadata(key, value)
    }

    private fun parseMetadataValue(): MetadataValue =
        when {
            check(TokenKind.StringLiteral) -> MetadataValue.Text(advance().lexeme)
            check(TokenKind.Number) -> MetadataValue.NumberValue(advance().lexeme.toDouble())
            check(TokenKind.Identifier) && peek().lexeme == "nil" -> {
                advance()
                MetadataValue.Nil
            }
            check(TokenKind.Identifier) -> MetadataValue.Identifier(advance().lexeme)
            else -> error("metadata value")
        }

    private fun parsePointList(): List<Coordinates> {
        val points = mutableListOf(parsePoint())
        expect(TokenKind.Comma, ",")
        points.add(parsePoint())
        expect(TokenKind.Comma, ",")
        points.add(parsePoint())
        while (match(TokenKind.Comma)) {
            points.add(parsePoint())
        }
        return points
    }

    private fun parsePoint(): Coordinates {
        expect(TokenKind.LeftParen, "(")
        val lon = expectNumber()
        expect(TokenKind.Comma, ",")
        val lat = expectNumber()
        expect(TokenKind.RightParen, ")")
        return Coordinates(lon, lat)
    }

    private fun expectKeyword(keyword: String) {
        val token = expect(TokenKind.Identifier, keyword)
        if (token.lexeme != keyword) {
            throw ParseException("Expected '$keyword' at ${token.line}:${token.column}, got '${token.lexeme}'")
        }
    }

    private fun expectString(): String = expect(TokenKind.StringLiteral, "string").lexeme
    private fun expectIdentifier(): String = expect(TokenKind.Identifier, "identifier").lexeme
    private fun expectNumber(): Double = expect(TokenKind.Number, "number").lexeme.toDouble()

    private fun expectInteger(): Int {
        val token = expect(TokenKind.Number, "integer")
        if (token.lexeme.contains('.')) {
            throw ParseException("Expected integer at ${token.line}:${token.column}, got '${token.lexeme}'")
        }
        return token.lexeme.toInt()
    }

    private fun expect(kind: TokenKind, expected: String): Token {
        if (check(kind)) return advance()
        val token = peek()
        throw ParseException("Expected $expected at ${token.line}:${token.column}, got '${token.lexeme}'")
    }

    private fun match(kind: TokenKind): Boolean {
        if (!check(kind)) return false
        advance()
        return true
    }

    private fun check(kind: TokenKind) = peek().kind == kind
    private fun peek() = tokens[index]
    private fun advance() = tokens[index++]

    private fun error(expected: String): Nothing {
        val token = peek()
        throw ParseException("Expected $expected at ${token.line}:${token.column}, got '${token.lexeme}'")
    }
}
