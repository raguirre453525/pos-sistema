using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Net.Http.Headers;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;

namespace MetraTC.Application.Services.Assistant;

public record RawProductExtract(
    string? Name,
    string? Sku,
    decimal? Price,
    decimal? StockDelta,
    string? Barcode,
    string? Description,
    List<string>? CategoryNames,
    bool StockDirectionRequired = false,
    decimal? ExplicitStockDelta = null,
    bool BlockInactiveProduct = false
);

public sealed record ImageProductListExtraction(bool IsProductList, List<RawProductExtract> Products);

public class AssistantProductExtractor
{
    private readonly IConfiguration _configuration;
    private readonly HttpClient _httpClient;
    private readonly ILogger<AssistantProductExtractor> _logger;

    private const string ExtractionPrompt =
        "Sos extractor de productos para MetraTC. Del mensaje del empleado y del historial, extrae TODOS los productos mencionados con: name, sku, price, stockDelta (ajuste firmado de stock), barcode, description, categoryNames[].\n" +
        "- stockDelta: cantidad firmada: positiva para sumar/reponer y negativa para descontar/quitar/restar/bajar. Si dicen \"10 unidades\", \"me llegaron 5\", \"reponer 20\" -> positivo; si dicen \"descontar 3\", \"quitar 2\", \"restar 4\" o \"bajar 1\" -> negativo. Convierte palabras \"uno/dos/tres/cuatro/cinco/seis/siete/ocho/nueve/diez\" a int.\n" +
        "- price: si mencionan \"$1500\" o \"a 1500\" \u2192 decimal.\n" +
        "- name: normaliza a singular y capitaliza (ej \"jugos cepita\" -> \"Jugo Cepita\"), sin plural extra ni sufijos de cantidad. Si dicen \"dos jugos cepita\" -> name \"Jugo Cepita\".\n" +
        "- Si no hay dato, null. No inventes sku/price si no estan explicitos.\n" +
        "IMPORTANTE: Si el mensaje actual solo aporta datos faltantes (precio, sku, stock) y el historial menciona el producto (ej \"Yerba Union\"), asocia esos datos al producto del historial y devuelve name/stockDelta del historial completando con los nuevos. Nunca devuelvas name null si el historial tiene el nombre. Si el historial tiene \"Yerba Union con 20 unidades\" y el usuario dice \"sku XXX precio 1700\", devuelve {name:\"Yerba Union\", sku:\"XXX\", price:1700, stockDelta:20}. Si el mensaje dice \"del azucar ledesma, el sku es 9aldj1029 y el precio es 1350\" devuelve name \"Azucar Ledesma\" con esos sku/price y stockDelta del historial.\n" +
        "Responde SOLO JSON: { \"products\": [ { \"name\":..., \"sku\":..., \"price\":..., \"stockDelta\":..., \"barcode\":..., \"description\":..., \"categoryNames\":[...] } ] }";

    private const string ImageExtractionPrompt =
        "Extract product rows from the current image(s) and current user text only. Return JSON only with this shape: " +
        "{\"isProductList\":true|false,\"products\":[{\"name\":string|null,\"sku\":string|null,\"price\":number|null,\"stock\":number|null}]}\n" +
        "Set isProductList true only for a visible product list or table with one or more rows; a product photo or ordinary scene is not a list. " +
        "Return one object per visible product row. Keep SKU as a string, preserving every digit including leading zeroes. " +
        "Use null for missing, illegible, or uncertain fields; never guess or supply defaults. Prices and stock amounts must be JSON numbers using a decimal point. " +
        "Stock is an unsigned amount. Never infer an adjustment direction from the image or return a signed stock delta; only an explicit direction in the user's text may be used by the application. " +
        "Do not infer any value from chat history or from another field. If no product list is present, return isProductList false and an empty products array.";

    private static readonly Regex ExplicitlyReadOnlyPattern = new(
        @"\b(?:solo|solamente|unicamente|únicamente)\s+(?:consulta|consultar|pregunta|preguntar)\b|\b(?:sin|no)\s+(?:modificar|modifiques|cambiar|cambies|actualizar|actualices|ajustar|ajustes|reponer|repongas|agregar|agregues|sumar|sumes)\s+(?:(?:el|la|su)\s+)?(?:stock|inventario|existencias)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex QuestionPattern = new(
        @"[¿?]|\b(?:cu[aá]nt[oa]s?|qu[eé]\s+cantidad|stock\s+(?:actual|disponible)|cu[aá]nto\s+stock)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex DirectWritePattern = new(
        @"^\s*(?:por\s+favor\s+|please\s+)?(?:crear|crea|creá|create|agregar|agrega|agregá|agregame|add|reponer|repone|reponé|reponeme|sumar|suma|sumá|aumentar|aumenta|aumentá|incrementar|incrementa|incrementá|ajustar|ajusta|ajustá|descontar|descuenta|descontá|quitar|quita|quitá|restar|resta|restá|bajar|baja|bajá|actualizar|actualiza|actualizá|cambiar|cambia|cambiá|modificar|modifica|modificá|cargar|carga|cargá|importar|importa|importá|load|import)\b|\b(?:creá|agregá|reponé|sumá|aumentá|incrementá|ajustá|descontá|quitá|restá|bajá|actualizá|cambiá|modificá|cargá|importá)\b|\b(?:me\s+llegaron|llegaron)\s+(?:\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\b|\b(?:quiero|necesito|pod[eé]s|podr[ií]as|quisiera|please|could\s+you|can\s+you)\b.{0,40}\b(?:crear|crea|creá|create|agregar|agrega|agregá|agregues|agregue|add|reponer|repone|reponé|repongas|sumar|suma|sumá|aumentar|aumenta|aumentá|incrementar|incrementa|incrementá|ajustar|ajusta|ajustá|descontar|descuenta|descontá|quitar|quita|quitá|restar|resta|restá|bajar|baja|bajá|actualizar|actualiza|actualizá|cambiar|cambia|cambiá|modificar|modifica|modificá|cargar|carga|cargá|importar|importa|importá|load|import)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex ProductLoadPattern = new(
        @"\b(?:load|import|cargar|carga|cargá|importar|importa|importá)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex NegatedProductLoadPattern = new(
        @"\b(?:no|not|don't|do\s+not|never|sin)\s+(?:(?:quiero|want\s+to|voy\s+a|going\s+to)\s+)?(?:load|import|cargar|carga|cargá|importar|importa|importá)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex QuantityWithUnitsPattern = new(
        @"\b(?:\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+unidades?\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex StockAmountBeforeDecreasePattern = new(
        @"\b(?:\d+|uno|una|un|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez)\s+(?:unidades?|unidad|u\.|de|del)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex StockIncreasePattern = new(
        @"\b(?:agregar|agrega|agregá|agregame|add|reponer|repone|reponé|reponeme|sumar|suma|sumá|aumentar|aumenta|aumentá|incrementar|incrementa|incrementá|replenish|restock|increase|me\s+llegaron|llegaron)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex StockCreationPattern = new(
        @"\b(?:crear|crea|creá)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    private static readonly Regex StockDecreasePattern = new(
        @"\b(?:descontar|descuenta|descontá|quitar|quita|quitá|restar|resta|restá|bajar|baja|bajá|decrease|deduct|subtract|remove)\b",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

    public static bool IsReadOnlyRequest(string message)
    {
        if (string.IsNullOrWhiteSpace(message)) return false;
        if (ExplicitlyReadOnlyPattern.IsMatch(message)) return true;
        return QuestionPattern.IsMatch(message) && !DirectWritePattern.IsMatch(message);
    }

    public static bool HasInventoryWriteIntent(string message)
    {
        if (string.IsNullOrWhiteSpace(message) || ExplicitlyReadOnlyPattern.IsMatch(message) || NegatedProductLoadPattern.IsMatch(message)) return false;
        if (DirectWritePattern.IsMatch(message) || (ProductLoadPattern.IsMatch(message) && !QuestionPattern.IsMatch(message))) return true;
        return !QuestionPattern.IsMatch(message) &&
            (QuantityWithUnitsPattern.IsMatch(message) || HasExplicitStockDirection(message));
    }

    public static bool HasStockMovementIntent(string message) =>
        !string.IsNullOrWhiteSpace(message) &&
        (StockDecreasePattern.IsMatch(message) || StockIncreasePattern.IsMatch(message) || QuantityWithUnitsPattern.IsMatch(message));

    public static bool HasExplicitStockDirection(string message) =>
        !string.IsNullOrWhiteSpace(message) &&
        (StockDecreasePattern.IsMatch(message) || StockIncreasePattern.IsMatch(message));

    public static bool TryNormalizeStockDirections(
        string message,
        IReadOnlyList<RawProductExtract> rawProducts,
        out List<RawProductExtract> normalized)
    {
        normalized = rawProducts.ToList();
        if (string.IsNullOrWhiteSpace(message)) return true;

        var decrease = StockDecreasePattern.Match(message);
        var increase = StockIncreasePattern.IsMatch(message);
        var creation = StockCreationPattern.IsMatch(message);
        if (decrease.Success &&
            (increase || creation || StockAmountBeforeDecreasePattern.IsMatch(message[..decrease.Index])))
            return false;

        decimal? sign = decrease.Success
            ? -1m
            : increase || creation || QuantityWithUnitsPattern.IsMatch(message) ? 1m : null;
        if (!sign.HasValue) return true;

        normalized = rawProducts
            .Select(raw => raw with
            {
                StockDelta = raw.StockDelta is { } delta ? sign.Value * Math.Abs(delta) : null
            })
            .ToList();
        return true;
    }

    public static bool HasConsistentStockDirection(string message) =>
        string.IsNullOrWhiteSpace(message) ||
        !(StockDecreasePattern.IsMatch(message) && StockIncreasePattern.IsMatch(message));

    public AssistantProductExtractor(IConfiguration configuration, HttpClient httpClient, ILogger<AssistantProductExtractor> logger)
    {
        _configuration = configuration;
        _httpClient = httpClient;
        _logger = logger;
    }

    public async Task<List<RawProductExtract>> ExtractAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, CancellationToken ct)
    {
        var provider = (_configuration["Assistant:Provider"] ?? "deepseek").Trim().ToLowerInvariant();
        if (provider == "mock")
            return MockExtract(message, history);

        if (provider == "openrouter") OpenRouterAssistantProvider.ValidateConfiguration(_configuration);
        else if (provider is not ("openai" or "deepseek"))
            throw new NotSupportedException($"Product extraction is not supported for provider '{provider}'.");

        // Use the explicitly selected provider for structured text extraction.
        try
        {
            return await LlmExtractAsync(message, history, provider, ct);
        }
        catch (Exception ex) when (ex is not OperationCanceledException and not TimeoutException and not HttpRequestException)
        {
            if (provider == "openrouter") throw new HttpRequestException("OpenRouter devolvió una extracción no válida.");
            _logger.LogWarning(ex, "Extraction LLM failed, returning empty");
            return new List<RawProductExtract>();
        }
    }

    public async Task<ImageProductListExtraction> ExtractImageListAsync(string message, IReadOnlyList<AssistantImage> images, CancellationToken ct)
    {
        if (images.Count == 0) return new ImageProductListExtraction(false, []);

        var provider = (_configuration["Assistant:Provider"] ?? "deepseek").Trim().ToLowerInvariant();
        if (provider is not ("deepseek" or "openrouter"))
            throw new NotSupportedException("Las imágenes requieren DeepSeek u OpenRouter.");
        var apiKey = provider == "deepseek" ? DeepSeekAssistantProvider.GetApiKey(_configuration) : null;
        if (provider == "deepseek" && string.IsNullOrWhiteSpace(apiKey))
            throw new InvalidOperationException("Configura Assistant:DeepSeek:ApiKey");
        if (provider == "openrouter") OpenRouterAssistantProvider.ValidateConfiguration(_configuration);

        var model = _configuration["Assistant:DeepSeek:Model"];
        if (string.IsNullOrWhiteSpace(model)) model = "deepseek-flash";

        var content = new List<object>();
        if (!string.IsNullOrWhiteSpace(message)) content.Add(new { type = "text", text = message });
        content.AddRange(images.Select(image => (object)new
        {
            type = "image_url",
            image_url = new { url = image.DataUrl }
        }));

        var payload = new
        {
            model,
            messages = new object[]
            {
                new { role = "system", content = ImageExtractionPrompt },
                new { role = "user", content }
            },
            response_format = new { type = "json_object" },
            max_tokens = 1200,
            temperature = 0,
            thinking = new { type = "disabled" }
        };

        using var request = provider == "openrouter"
            ? OpenRouterAssistantProvider.CreateRequest(_configuration, payload.messages, 1200, 0, jsonOutput: true)
            : new HttpRequestMessage(HttpMethod.Post, "https://api.deepseek.com/chat/completions")
        {
            Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
        };
        if (provider == "deepseek") request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        string responseContent;
        if (provider == "openrouter") responseContent = await OpenRouterAssistantProvider.CompleteAsync(_httpClient, request, ct);
        else
        {
            using var response = await DeepSeekAssistantProvider.SendAsync(_httpClient, request, ct);
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException($"DeepSeek image extraction error {(int)response.StatusCode}.");
            responseContent = DeepSeekAssistantProvider.ReadCompletedContent(await response.Content.ReadAsStringAsync(ct));
        }
        JsonDocument extracted;
        try { extracted = JsonDocument.Parse(responseContent); }
        catch (JsonException) { throw new HttpRequestException($"{provider} devolvió una extracción de imagen no válida."); }
        using var extractedDocument = extracted;
        var root = extracted.RootElement;
        if (root.ValueKind != JsonValueKind.Object ||
            !root.TryGetProperty("isProductList", out var listValue) || listValue.ValueKind is not (JsonValueKind.True or JsonValueKind.False) ||
            !root.TryGetProperty("products", out var rows) || rows.ValueKind != JsonValueKind.Array)
            throw new HttpRequestException($"{provider} devolvió una extracción de imagen no válida.");
        if (!listValue.GetBoolean())
        {
            if (rows.GetArrayLength() != 0)
                throw new HttpRequestException($"{provider} devolvió una extracción de imagen no válida.");
            return new ImageProductListExtraction(false, []);
        }

        var products = new List<RawProductExtract>();
        foreach (var row in rows.EnumerateArray())
        {
            if (row.ValueKind != JsonValueKind.Object) continue;
            var name = ReadString(row, "name")?.Trim();
            var sku = ReadString(row, "sku")?.Trim().ToUpperInvariant();
            var price = ReadDecimal(row, "price");
            var amount = ReadDecimal(row, "stock");
            var directionRequired = amount.HasValue;
            decimal? stockDelta = amount;
            if (amount < 0)
            {
                stockDelta = null;
                directionRequired = true;
            }

            if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(sku) && price == null && stockDelta == null)
                continue;

            products.Add(new RawProductExtract(name, sku, price, stockDelta, null, null, null, directionRequired));
        }

        return new ImageProductListExtraction(true, products);
    }

    private static string? ReadString(JsonElement element, string property) =>
        element.TryGetProperty(property, out var value) && value.ValueKind == JsonValueKind.String
            ? value.GetString()
            : null;

    private static decimal? ReadDecimal(JsonElement element, string property)
    {
        if (!element.TryGetProperty(property, out var value) || value.ValueKind == JsonValueKind.Null) return null;
        if (value.ValueKind == JsonValueKind.Number && value.TryGetDecimal(out var number)) return number;
        if (value.ValueKind == JsonValueKind.String && decimal.TryParse(value.GetString(),
            System.Globalization.NumberStyles.AllowLeadingSign | System.Globalization.NumberStyles.AllowDecimalPoint,
            System.Globalization.CultureInfo.InvariantCulture, out number)) return number;
        return null;
    }

    private static string NormalizeNumberWords(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return input;
        var map = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase)
        {
            ["uno"] = "1", ["un"] = "1", ["una"] = "1",
            ["dos"] = "2", ["tres"] = "3", ["cuatro"] = "4", ["cinco"] = "5",
            ["seis"] = "6", ["siete"] = "7", ["ocho"] = "8", ["nueve"] = "9", ["diez"] = "10"
        };
        var result = input;
        foreach (var kv in map)
        {
            result = Regex.Replace(result, $@"\b{Regex.Escape(kv.Key)}\b", kv.Value, RegexOptions.IgnoreCase);
        }
        return result;
    }

    private static string NormalizeProductName(string? name)
    {
        if (string.IsNullOrWhiteSpace(name)) return name ?? string.Empty;
        var words = name.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        var normalized = words.Select(w =>
        {
            // singular simple: quita 's' final if length > 3 and ends with s
            var lower = w.ToLowerInvariant();
            if (lower.EndsWith("s") && w.Length > 3)
                w = w[..^1];
            // Capitalize first letter
            if (w.Length == 0) return w;
            return char.ToUpperInvariant(w[0]) + w[1..].ToLowerInvariant();
        });
        return string.Join(" ", normalized);
    }

    private List<RawProductExtract> MockExtract(string message, IReadOnlyList<ChatMessage> history)
    {
        var combined = message ?? "";
        combined = NormalizeNumberWords(combined);

        // Extract nameHint from history: last assistant message with Detecté **name**
        string? nameHint = null;
        if (history != null)
        {
            for (int i = history.Count - 1; i >= 0; i--)
            {
                var h = history[i];
                if (h.Role == "assistant" && !string.IsNullOrWhiteSpace(h.Content) && h.Content.Contains("Detecté **"))
                {
                    var m = Regex.Match(h.Content, @"Detecté \*\*(.+?)\*\*");
                    if (m.Success)
                    {
                        nameHint = m.Groups[1].Value.Trim();
                        break;
                    }
                }
            }
        }
        // If current message has no creation verb but has precio/sku/number and we have a hint, prepend hint so ParseSegment recovers name+stockDelta
        if (nameHint != null)
        {
            var hasCreationVerb = Regex.IsMatch(combined, @"(crear|creá|agregar|reponer|reponé)", RegexOptions.IgnoreCase);
            var hasDataHint = Regex.IsMatch(combined, @"(precio|sku|\d)", RegexOptions.IgnoreCase);
            var hasNameAlready = combined.IndexOf(nameHint, StringComparison.OrdinalIgnoreCase) >= 0;
            if (!hasCreationVerb && hasDataHint && !hasNameAlready)
            {
                combined = nameHint + " " + combined;
            }
        }

        var results = new List<RawProductExtract>();
        // Try to detect multiple products split by comma, " y ", ";"
        var segments = Regex.Split(combined, @"\s*(?:,|;|\s+y\s+)\s*", RegexOptions.IgnoreCase);
        // If only one segment, keep it
        if (segments.Length == 0) segments = new[] { combined };
        bool anyFound = false;
        foreach (var seg in segments)
        {
            var extract = ParseSegment(seg.Trim());
            if (extract != null)
            {
                results.Add(extract);
                anyFound = true;
            }
        }
        // If we split aggressively and got nothing, try whole message as one
        if (!anyFound)
        {
            var single = ParseSegment(combined.Trim());
            if (single != null) results.Add(single);
        }
        return results;
    }

    private RawProductExtract? ParseSegment(string segment)
    {
        if (string.IsNullOrWhiteSpace(segment)) return null;
        // Heuristic: must look like inventory intent -> contains number or sku/price/category keywords
        var hasIntentKeyword = Regex.IsMatch(segment, @"(crear|creá|agregar|agregá|reponer|reponé|descontar|descuenta|descontá|quitar|quita|quitá|restar|resta|restá|bajar|baja|bajá|stock|sku|precio|categoría|categoria|unidades|unidad)", RegexOptions.IgnoreCase);
        var hasNumber = Regex.IsMatch(segment, @"\d");
        if (!hasIntentKeyword && !hasNumber) return null;

        // SKU extraction: "SKU XXX123" or "sku: XXX" or "sku es XXX"
        string? sku = null;
        var skuMatch = Regex.Match(segment, @"sku\s*(?:es)?\s*[:\-]?\s*([A-Za-z0-9][A-Za-z0-9_\-]*)", RegexOptions.IgnoreCase);
        if (skuMatch.Success)
        {
            sku = skuMatch.Groups[1].Value.Trim().ToUpperInvariant();
            // Fallback: si capturó "ES" porque regex capturó el "es" literal, recapturar siguiente token alfanumérico
            if (sku == "ES" || sku == "E")
            {
                var retry = Regex.Match(segment, @"sku\s*(?:es)?\s*[:\-]?\s*(?:es\s+)?([A-Za-z0-9][A-Za-z0-9_\-]*)", RegexOptions.IgnoreCase);
                // segunda captura más robusta: buscar token después de "sku es"
                var alt = Regex.Match(segment, @"sku\s+es\s+([A-Za-z0-9][A-Za-z0-9_\-]*)", RegexOptions.IgnoreCase);
                if (alt.Success) sku = alt.Groups[1].Value.Trim().ToUpperInvariant();
                else
                {
                    var nextToken = Regex.Match(segment.Substring(skuMatch.Index + skuMatch.Length).Trim(), @"^([A-Za-z0-9][A-Za-z0-9_\-]*)");
                    if (nextToken.Success) sku = nextToken.Groups[1].Value.Trim().ToUpperInvariant();
                    else sku = null;
                }
            }
        }

        // Price extraction: "$1500" or "a 1500" or "precio 1500" or "a $1500"
        decimal? price = null;
        var priceMatch = Regex.Match(segment, @"(?:precio\s*[:\-]?\s*)?(?:a\s+)?\$?\s*(\d+(?:[.,]\d+)?)\s*(?:pesos)?", RegexOptions.IgnoreCase);
        // Refine: look for "$" explicitly or " a <num>"
        var priceExplicit = Regex.Match(segment, @"\$\s*(\d+(?:[.,]\d+)?)");
        var priceA = Regex.Match(segment, @"\ba\s+\$?\s*(\d+(?:[.,]\d+)?)\b", RegexOptions.IgnoreCase);
        var pricePre = Regex.Match(segment, @"precio[^0-9]*(\d+(?:[.,]\d+)?)", RegexOptions.IgnoreCase);
        var priceEs = Regex.Match(segment, @"es\s+\$?\s*(\d+(?:[.,]\d+)?)", RegexOptions.IgnoreCase);
        if (priceExplicit.Success) price = ParseDecimal(priceExplicit.Groups[1].Value);
        else if (priceA.Success) price = ParseDecimal(priceA.Groups[1].Value);
        else if (pricePre.Success) price = ParseDecimal(pricePre.Groups[1].Value);
        else if (priceEs.Success) price = ParseDecimal(priceEs.Groups[1].Value);
        // If we found generic match but also sku/price ambiguous, only keep if preceded by $ or "a"/precio
        // So ignore generic match unless explicit.

        // StockDelta extraction: "10 unidades", "10 u.", "me llegaron 5", "reponer 20", "con 10", "10 unidades"
        int? stockDelta = null;
        var stockMatch = Regex.Match(segment, @"(\d+)\s*(?:unidades|unidad|u\.)", RegexOptions.IgnoreCase);
        if (stockMatch.Success) stockDelta = int.Parse(stockMatch.Groups[1].Value);
        else
        {
            // "reponer 20", "agregar 5", "con 10"
            var stockAlt = Regex.Match(segment, @"(?:reponer|repone|reponé|agregar|agrega|agregá|crear|con|sumar|suma|sumá|me\s+llegaron|llegaron|descontar|descuenta|descontá|quitar|quita|quitá|restar|resta|restá|bajar|baja|bajá)\s*(\d+)", RegexOptions.IgnoreCase);
            if (stockAlt.Success) stockDelta = int.Parse(stockAlt.Groups[1].Value);
            else
            {
                // fallback: any number that is likely stock if there's also a product name and not price?
                var allNums = Regex.Matches(segment, @"\b(\d+)\b");
                if (allNums.Count > 0 && price == null && sku == null)
                {
                    // Heuristic: small numbers (1-200) likely stock, large (300+) likely price unless explícitamente unidades
                    // For single number large -> treat as price (corrección "coca es 1500")
                    var first = allNums[0].Groups[1].Value;
                    if (int.TryParse(first, out var v) && v > 0 && v < 100000)
                    {
                        if (v >= 300) price = v;
                        else stockDelta = v;
                    }
                    // If two numbers, larger is price
                    if (allNums.Count >= 2)
                    {
                        var nums = allNums.Cast<Match>().Select(m => int.Parse(m.Groups[1].Value)).OrderByDescending(n => n).ToList();
                        // re-evaluate: biggest as price, smallest as stock if both present and not already set
                        if (price == null && nums[0] >= 300) price = nums[0];
                        if (stockDelta == null && nums.Count > 1)
                        {
                            var small = nums.Last();
                            if (small != price) stockDelta = small;
                            else if (nums.Count > 1) stockDelta = nums[1];
                        }
                    }
                }
                else if (allNums.Count >= 2 && price != null)
                {
                    // If we have price, stock is the other number
                    foreach (Match m in allNums)
                    {
                        var val = ParseDecimal(m.Groups[1].Value);
                        if (val != price) { if (int.TryParse(m.Groups[1].Value, out var iv)) { stockDelta = iv; break; } }
                    }
                }
                // Also handle bare price without stock: if we have a large number left and no price, promote to price
                if (price == null && stockDelta != null && stockDelta >= 300)
                {
                    // Stock large likely was actually price
                    price = stockDelta;
                    stockDelta = null;
                }
            }
        }

        if (stockDelta.HasValue && StockDecreasePattern.IsMatch(segment))
            stockDelta = -stockDelta.Value;

        // CategoryNames: "categoría Almacén" "categoria: Bebidas"
        List<string>? categories = null;
        var catMatch = Regex.Match(segment, @"categor[ií]a[s]?\s*[:\-]?\s*([A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]+?)(?:\s*(?:,|y\s|$))", RegexOptions.IgnoreCase);
        if (catMatch.Success)
        {
            var catRaw = catMatch.Groups[1].Value.Trim();
            // trim trailing words that are likely not category but price/stock leftovers
            catRaw = Regex.Replace(catRaw, @"\s+a\s+\$?\d+.*$", "", RegexOptions.IgnoreCase).Trim();
            catRaw = Regex.Replace(catRaw, @"\s+con\s+\d+.*$", "", RegexOptions.IgnoreCase).Trim();
            if (!string.IsNullOrWhiteSpace(catRaw))
                categories = new List<string> { catRaw };
        }

        // Name extraction: remove known tokens and remaining is name
        var name = ExtractName(segment, sku, price, stockDelta, categories);
        if (!string.IsNullOrWhiteSpace(name))
            name = NormalizeProductName(name);

        if (string.IsNullOrWhiteSpace(name) && sku == null) return null;
        // If name is generic like "producto" without sku, still need something; but skip if nothing
        if (string.IsNullOrWhiteSpace(name)) name = sku; // fallback to sku as name if no name
        if (!string.IsNullOrWhiteSpace(name))
            name = NormalizeProductName(name);

        // If we still have no price, no sku, no stockDelta and name is very short generic, skip
        if (stockDelta == null && price == null && sku == null && (name == null || name.Length < 2)) return null;
        // Require at least name or sku
        if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(sku)) return null;

        // Barcode / description not parsed in mock
        return new RawProductExtract(
            Name: name?.Trim(),
            Sku: sku,
            Price: price,
            StockDelta: stockDelta,
            Barcode: null,
            Description: null,
            CategoryNames: categories
        );
    }

    private string? ExtractName(string segment, string? sku, decimal? price, int? stockDelta, List<string>? categories)
    {
        var cleaned = segment;
        // Remove sku token (soporta "sku es XXX")
        if (!string.IsNullOrWhiteSpace(sku))
            cleaned = Regex.Replace(cleaned, @"sku\s*(?:es)?\s*[:\-]?\s*" + Regex.Escape(sku), "", RegexOptions.IgnoreCase);
        // Remove price tokens
        cleaned = Regex.Replace(cleaned, @"\$\s*\d+(?:[.,]\d+)?", "", RegexOptions.IgnoreCase);
        cleaned = Regex.Replace(cleaned, @"\bprecio\b[^,]*", "", RegexOptions.IgnoreCase);
        if (price != null)
        {
            var pStr = price.Value.ToString(System.Globalization.CultureInfo.InvariantCulture).Replace(".","\\.");
            cleaned = Regex.Replace(cleaned, @"\b" + pStr + @"\b", "", RegexOptions.IgnoreCase);
            // also bare price numbers that might remain (large numbers)
            cleaned = Regex.Replace(cleaned, @"\b\d{3,}\b", "", RegexOptions.IgnoreCase);
        }
        // Remove stock tokens
        cleaned = Regex.Replace(cleaned, @"\d+\s*(?:unidades|unidad|u\.)", "", RegexOptions.IgnoreCase);
        if (stockDelta != null)
            cleaned = Regex.Replace(cleaned, @"\b" + Math.Abs(stockDelta.Value) + @"\b", "", RegexOptions.IgnoreCase);
        // Remove category token
        cleaned = Regex.Replace(cleaned, @"categor[ií]a[s]?\s*[:\-]?\s*[A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]+", "", RegexOptions.IgnoreCase);
        // Remove common verbs
        cleaned = Regex.Replace(cleaned, @"\b(crear|creá|crea|agregar|agrega|agregá|reponer|reponé|repone|sumar|suma|sumá|descontar|descuenta|descontá|quitar|quita|quitá|restar|resta|restá|bajar|baja|bajá|me\s+llegaron|llegaron|con|a|de|del|el|la|un|una|para|producto|productos)\b", "", RegexOptions.IgnoreCase);
        // Remove punctuation
        cleaned = Regex.Replace(cleaned, @"[^\p{L}\p{N}\s]", " ");
        cleaned = Regex.Replace(cleaned, @"\s+", " ").Trim();
        // If cleaned becomes empty but original had a word-like name before numbers, fallback
        if (string.IsNullOrWhiteSpace(cleaned))
        {
            // Try to capture word before/after number
            var m = Regex.Match(segment, @"([A-Za-zÁÉÍÓÚáéíóúÑñ][A-Za-zÁÉÍÓÚáéíóúÑñ0-9\s]{1,40})");
            if (m.Success) cleaned = m.Groups[1].Value.Trim();
        }
        // Take first 3-4 words as product name, limit
        var words = cleaned.Split(' ', StringSplitOptions.RemoveEmptyEntries);
        if (words.Length == 0) return null;
        // Filter short junk
        var filtered = words.Where(w => w.Length >= 2).ToArray();
        if (filtered.Length == 0) return null;
        var name = string.Join(" ", filtered.Take(4));
        return string.IsNullOrWhiteSpace(name) ? null : name.Trim();
    }

    private decimal? ParseDecimal(string s)
    {
        s = s.Replace(",", ".");
        if (decimal.TryParse(s, System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var d)) return d;
        return null;
    }

    private async Task<List<RawProductExtract>> LlmExtractAsync(string message, IReadOnlyList<ChatMessage> history, string provider, CancellationToken ct)
    {
        var messages = new List<object> { new { role = "system", content = ExtractionPrompt } };
        if (history != null)
        {
            foreach (var h in history.TakeLast(10))
            {
                var role = h.Role == "assistant" ? "assistant" : "user";
                messages.Add(new { role, content = h.Content });
            }
        }
        messages.Add(new { role = "user", content = message });

        HttpRequestMessage request;
        if (provider == "openrouter")
            request = OpenRouterAssistantProvider.CreateRequest(_configuration, messages, 600, 0.1, jsonOutput: true);
        else
        {
            var apiKey = provider == "openai"
                ? _configuration["Assistant:OpenAI:ApiKey"]
                : DeepSeekAssistantProvider.GetApiKey(_configuration);
            var model = provider == "openai"
                ? (_configuration["Assistant:OpenAI:Model"] ?? "gpt-4o-mini")
                : (_configuration["Assistant:DeepSeek:Model"] ?? "deepseek-flash");
            var url = provider == "openai"
                ? "https://api.openai.com/v1/chat/completions"
                : "https://api.deepseek.com/chat/completions";
            object payload = provider == "deepseek"
                ? new { model, messages, max_tokens = 600, temperature = 0.1, thinking = new { type = "disabled" } }
                : new { model, messages, max_tokens = 600, temperature = 0.1 };
            request = new HttpRequestMessage(HttpMethod.Post, url)
            {
                Content = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json")
            };
            request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        }
        using var ownedRequest = request;

        string? content;
        if (provider == "openrouter") content = await OpenRouterAssistantProvider.CompleteAsync(_httpClient, request, ct);
        else
        {
            using var response = provider == "deepseek"
                ? await DeepSeekAssistantProvider.SendAsync(_httpClient, request, ct)
                : await _httpClient.SendAsync(request, ct);
            if (!response.IsSuccessStatusCode)
                throw new HttpRequestException($"{provider} extraction error {(int)response.StatusCode}.");
            var body = await response.Content.ReadAsStringAsync(ct);

            using var doc = provider == "deepseek" ? null : JsonDocument.Parse(body);
            content = provider == "deepseek"
                ? DeepSeekAssistantProvider.ReadCompletedContent(body)
                : doc!.RootElement.GetProperty("choices")[0].GetProperty("message").GetProperty("content").GetString();
        }
        if (string.IsNullOrWhiteSpace(content)) return new List<RawProductExtract>();

        // Try to parse JSON from content (may be wrapped in markdown)
        var jsonStart = content.IndexOf('{');
        var jsonEnd = content.LastIndexOf('}');
        if (jsonStart >= 0 && jsonEnd > jsonStart)
        {
            var jsonSlice = content.Substring(jsonStart, jsonEnd - jsonStart + 1);
            try
            {
                using var inner = JsonDocument.Parse(jsonSlice);
                if (inner.RootElement.TryGetProperty("products", out var arr) && arr.ValueKind == JsonValueKind.Array)
                {
                    var list = new List<RawProductExtract>();
                    foreach (var el in arr.EnumerateArray())
                    {
                        var name = el.TryGetProperty("name", out var n) && n.ValueKind != JsonValueKind.Null ? n.GetString() : null;
                        var sku = el.TryGetProperty("sku", out var s) && s.ValueKind != JsonValueKind.Null ? s.GetString() : null;
                        decimal? price = null;
                        if (el.TryGetProperty("price", out var p) && p.ValueKind != JsonValueKind.Null)
                        {
                            if (p.ValueKind == JsonValueKind.Number && p.TryGetDecimal(out var dec)) price = dec;
                            else if (p.ValueKind == JsonValueKind.String && decimal.TryParse(p.GetString()?.Replace(",", "."), System.Globalization.NumberStyles.Any, System.Globalization.CultureInfo.InvariantCulture, out var dec2)) price = dec2;
                        }
                        decimal? stockDelta = provider == "openrouter" ? ReadDecimal(el, "stockDelta") : null;
                        if (provider != "openrouter" && el.TryGetProperty("stockDelta", out var sd) && sd.ValueKind != JsonValueKind.Null)
                        {
                            if (sd.ValueKind == JsonValueKind.Number && sd.TryGetInt32(out var iv)) stockDelta = iv;
                            else if (sd.ValueKind == JsonValueKind.String && int.TryParse(sd.GetString(), out var iv2)) stockDelta = iv2;
                        }
                        var barcode = el.TryGetProperty("barcode", out var b) && b.ValueKind != JsonValueKind.Null ? b.GetString() : null;
                        var desc = el.TryGetProperty("description", out var d) && d.ValueKind != JsonValueKind.Null ? d.GetString() : null;
                        List<string>? cats = null;
                        if (el.TryGetProperty("categoryNames", out var cn) && cn.ValueKind == JsonValueKind.Array)
                        {
                            cats = cn.EnumerateArray().Where(x => x.ValueKind == JsonValueKind.String).Select(x => x.GetString()!).Where(x => !string.IsNullOrWhiteSpace(x)).ToList();
                            if (cats.Count == 0) cats = null;
                        }
                        if (string.IsNullOrWhiteSpace(name) && string.IsNullOrWhiteSpace(sku)) continue;
                        list.Add(new RawProductExtract(name?.Trim(), sku?.Trim()?.ToUpperInvariant(), price, stockDelta, barcode, desc, cats));
                    }
                    return list;
                }
            }
            catch (Exception ex)
            {
                if (provider == "openrouter") throw new HttpRequestException("OpenRouter devolvió una extracción no válida.");
                _logger.LogWarning(ex, "Failed to parse extraction JSON");
                return new List<RawProductExtract>();
            }
        }
        if (provider == "openrouter") throw new HttpRequestException("OpenRouter devolvió una extracción no válida.");
        return new List<RawProductExtract>();
    }
}
