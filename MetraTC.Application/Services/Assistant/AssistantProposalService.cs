using System.Data;
using System.Text;
using System.Text.RegularExpressions;
using MetraTC.Application.Services;
using MetraTC.Application.Validators.Product;
using MetraTC.Domain.Entities;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static MetraTC.Application.DTOs.AssistantDtos;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services.Assistant;

public sealed class AssistantProposalOutcomeUnknownException(string message, Exception innerException)
    : Exception(message, innerException)
{
}

public class AssistantProposalService
{
    private readonly ApplicationDbContext _db;
    private readonly AssistantProductExtractor _extractor;
    private readonly IProductService _productService;
    private readonly ICategoryService _categoryService;
    private readonly ILogger<AssistantProposalService> _logger;

    public AssistantProposalService(
        ApplicationDbContext db,
        AssistantProductExtractor extractor,
        IProductService productService,
        ICategoryService categoryService,
        ILogger<AssistantProposalService> logger)
    {
        _db = db;
        _extractor = extractor;
        _productService = productService;
        _categoryService = categoryService;
        _logger = logger;
    }

    public async Task<ProposalResponse?> BuildProposalAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, Guid businessId, CancellationToken ct)
    {
        if (!AssistantProductExtractor.HasInventoryWriteIntent(message)) return null;
        var rawList = await _extractor.ExtractAsync(message, history, inventoryContext, ct);
        if (rawList == null || rawList.Count == 0) return null;
        if (!AssistantProductExtractor.TryNormalizeStockDirections(message, rawList, out var normalizedRaws))
            return null;
        return await BuildFromRawsAsync(normalizedRaws, businessId, ct);
    }

    public async Task<(bool IsProductList, ProposalResponse? Proposal, string? Reply)> BuildImageProposalAsync(
        string message,
        IReadOnlyList<AssistantImage> images,
        Guid businessId,
        CancellationToken ct)
    {
        var extraction = await _extractor.ExtractImageListAsync(message, images, ct);
        if (!extraction.IsProductList) return (false, null, null);
        if (extraction.Products.Count == 0)
            return (true, null, "Reconocí una lista de productos, pero no pude leer filas con datos suficientes. No se realizó ningún cambio.");
        if (!AssistantProductExtractor.HasConsistentStockDirection(message))
            return (true, null, "La solicitud mezcla aumentos y descuentos de stock. Aclará la dirección en texto para cada producto; no se realizó ningún cambio.");
        var rows = extraction.Products;

        if (AssistantProductExtractor.HasExplicitStockDirection(message))
        {
            var textRows = await _extractor.ExtractAsync(message, Array.Empty<ChatMessage>(), string.Empty, ct);
            if (!AssistantProductExtractor.TryNormalizeStockDirections(message, textRows, out var normalizedTextRows))
                return (true, null, "La solicitud mezcla aumentos y descuentos de stock. Aclará la dirección en texto para cada producto; no se realizó ningún cambio.");
            rows = AttachExplicitTextStockDeltas(rows, normalizedTextRows);
        }

        var proposal = await BuildFromRawsAsync(rows, businessId, ct, exactSkuOnly: true, blockInactiveProducts: true);
        return proposal is null
            ? (true, null, "Reconocí la lista, pero no encontré cambios de producto que pueda proponer. No se realizó ningún cambio.")
            : (true, proposal, null);
    }

    public static List<RawProductExtract> AttachExplicitTextStockDeltas(
        IReadOnlyList<RawProductExtract> imageRows,
        IReadOnlyList<RawProductExtract> textRows)
    {
        return imageRows.Select(imageRow =>
        {
            var matches = textRows.Where(textRow => textRow.StockDelta.HasValue && MatchesProduct(imageRow, textRow))
                .ToList();

            if (matches.Count == 0 && imageRows.Count == 1 && textRows.Count == 1 && textRows[0].StockDelta.HasValue &&
                string.IsNullOrWhiteSpace(textRows[0].Name) && string.IsNullOrWhiteSpace(textRows[0].Sku))
                matches.Add(textRows[0]);

            return matches.Count == 1
                ? imageRow with { ExplicitStockDelta = matches[0].StockDelta, StockDirectionRequired = false }
                : imageRow;
        }).ToList();

        static bool SameSku(string? left, string? right) =>
            !string.IsNullOrWhiteSpace(left) && !string.IsNullOrWhiteSpace(right) &&
            string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

        static bool SameName(string? left, string? right) =>
            !string.IsNullOrWhiteSpace(left) && !string.IsNullOrWhiteSpace(right) &&
            string.Equals(left.Trim(), right.Trim(), StringComparison.OrdinalIgnoreCase);

        static bool MatchesProduct(RawProductExtract image, RawProductExtract text)
        {
            if (SameSku(image.Sku, text.Sku)) return true;
            if (!string.IsNullOrWhiteSpace(image.Sku) && !string.IsNullOrWhiteSpace(text.Sku)) return false;
            return SameName(image.Name, text.Name);
        }
    }

    public async Task<ProposalResponse?> TryPatchPendingAsync(ProposalResponse pending, string message, IReadOnlyList<ChatMessage> history, string inventoryContext, Guid businessId, CancellationToken ct)
    {
        if (pending == null || !pending.HasMissingData || AssistantProductExtractor.IsReadOnlyRequest(message)) return null;
        var newRaws = await _extractor.ExtractAsync(message, history, inventoryContext, ct);
        if (newRaws == null || newRaws.Count == 0) return null;
        if (!AssistantProductExtractor.TryNormalizeStockDirections(message, newRaws, out var normalizedNewRaws))
            return null;
        newRaws = normalizedNewRaws;

        // Helpers para comparar nombres tolerante
        string Norm(string? s) => (s ?? "").Trim().ToLowerInvariant();
        bool NamesMatch(string? a, string? b){
            if (string.IsNullOrWhiteSpace(a) || string.IsNullOrWhiteSpace(b)) return false;
            var na = Norm(a); var nb = Norm(b);
            if (na == nb) return true;
            // singular trick
            string Sing(string x){ return x.EndsWith("s") && x.Length>2 ? x[..^1] : x; }
            if (Sing(na) == Sing(nb)) return true;
            // contains both ways
            if (na.Contains(nb) || nb.Contains(na)) return true;
            // token overlap >= half
            var ta = na.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Sing).Where(x=>x.Length>=2).ToHashSet();
            var tb = nb.Split(' ', StringSplitOptions.RemoveEmptyEntries).Select(Sing).Where(x=>x.Length>=2).ToHashSet();
            if (ta.Count>0 && tb.Count>0 && ta.Intersect(tb).Count() >= Math.Min(ta.Count, tb.Count)) return true;
            return false;
        }

        bool MessageMentionsProduct(string msg, string prodName)
        {
            if (string.IsNullOrWhiteSpace(msg) || string.IsNullOrWhiteSpace(prodName)) return false;
            var ml = msg.ToLowerInvariant();
            // generic tokens that alone are not distinctive
            var generic = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
            {
                "gaseosa","bebida","bebidas","litro","litros","kilo","kilos","gramo","gramos","paquete","paquetes","botella","botellas","unidad","unidades","producto","productos","l","ml","cc"
            };
            string Sing(string x) => x.EndsWith("s") && x.Length > 2 ? x[..^1] : x;
            string NormToken(string t) => Sing(t.ToLowerInvariant());
            // tokenize product name: keep letters/digits, length >=2 or numeric
            var rawTokens = prodName.ToLowerInvariant().Split(new[] {' ', '-', '_', '.', ',', '(', ')', '/'}, StringSplitOptions.RemoveEmptyEntries);
            var tokens = rawTokens
                .Select(t => new string(t.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant())
                .Where(t => t.Length >= 2 || int.TryParse(t, out _))
                .Select(NormToken)
                .Where(t => t.Length >= 2)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            if (tokens.Count == 0) return false;
            int matched = 0;
            bool hasDistinctive = false;
            foreach (var tok in tokens)
            {
                // word-boundary tolerant: contains as substring but ensure token appears
                // use simple contains; for short tokens like "up" require word boundary to avoid false positives
                bool contains;
                if (tok.Length <= 2)
                {
                    // require word boundary for very short tokens
                    contains = System.Text.RegularExpressions.Regex.IsMatch(ml, @"\b" + System.Text.RegularExpressions.Regex.Escape(tok) + @"\b");
                }
                else
                {
                    contains = ml.Contains(tok);
                }
                if (contains)
                {
                    matched++;
                    if (!generic.Contains(tok) && tok.Length >= 3)
                        hasDistinctive = true;
                }
            }
            if (hasDistinctive) return true;
            if (matched >= 2) return true;
            return false;
        }

        var hasStockMovementIntent = AssistantProductExtractor.HasStockMovementIntent(message);
        if (hasStockMovementIntent && pending.Proposals.Count > 1 &&
            !pending.Proposals.Any(p => MessageMentionsProduct(message, p.Name)))
            return null;

        // Ambigüedad: 2+ productos faltan y usuario manda un solo sku/precio sin decir producto
        var missingProducts = pending.Proposals.Where(p => p.MissingFields.Any(f => f == "Sku" || f == "Price")).ToList();
        {
            var missingCount = missingProducts.Count;
            if (missingCount >= 2 && newRaws.Count == 1)
            {
                var nr = newRaws[0];
                bool mentionsAnyPending = pending.Proposals.Any(p => MessageMentionsProduct(message, p.Name));
                if ((nr.Sku != null || nr.Price != null) && !mentionsAnyPending)
                {
                    var names = string.Join(" y ", missingProducts.Select(p => p.Name));
                    var clarification = $"⚠️ Me faltan SKU y precio para: {names}. Me pasaste un SKU/Precio sin decir a qué producto pertenece. Por favor decime natural a qué producto corresponde cada dato, ej: 'para seven up sku 987... precio 3000 y para manteca sku 123... precio 2500'.";
                    return new ProposalResponse(pending.Proposals, clarification, NeedsConfirmation: false,
                        HasMissingData: true, RequireExactSkuMatch: pending.RequireExactSkuMatch);
                }
            }
        }

        // Build patched raws from pending
        var patchedRaws = pending.Proposals.Select(p => new RawProductExtract(
            p.Name,
            p.Sku,
            p.Price,
            p.StockDelta,
            p.Barcode,
            p.Description,
            p.CategoryNames,
            p.MissingFields.Contains("Dirección de stock"),
            BlockInactiveProduct: p.MissingFields.Contains("Producto inactivo; su reactivación debe realizarla un administrador"))).ToList();
        bool anyPatched = false;
        var usedIndices = new HashSet<int>();

        // Unified patch: allow patching any pending (even already filled) if NamesMatch indicates correction
        foreach (var nr in newRaws)
        {
            int bestIdx = -1; int bestScore = -1;
            for (int i = 0; i < pending.Proposals.Count; i++)
            {
                if (usedIndices.Contains(i)) continue;
                var pp = pending.Proposals[i];
                // nr without name: only candidate if message explicitly mentions that product, unless single missing
                if (string.IsNullOrWhiteSpace(nr.Name))
                {
                    var mentionsThis = MessageMentionsProduct(message, pp.Name);
                    if (!mentionsThis)
                    {
                        // allow nameless patch only if there's a single pending with missing (Azúcar case)
                        var missingCountSingle = pending.Proposals.Count(p => p.MissingFields.Count > 0);
                        if (!(newRaws.Count == 1 && pending.Proposals.Count == 1 && pp.MissingFields.Count > 0))
                        {
                            if (missingCountSingle != 1) continue;
                            // if single missing across many pendings, allow fallback but low score
                        }
                    }
                }
                else
                {
                    var repairsMissingName = pp.MissingFields.Contains("Name") &&
                        (pending.Proposals.Count == 1 ||
                         !string.IsNullOrWhiteSpace(nr.Sku) && string.Equals(nr.Sku, pp.Sku, StringComparison.OrdinalIgnoreCase));
                    if (!NamesMatch(nr.Name, pp.Name) && !repairsMissingName) continue;
                }

                int score = 0;
                if (!string.IsNullOrWhiteSpace(nr.Name) &&
                    (NamesMatch(nr.Name, pp.Name) || pp.MissingFields.Contains("Name"))) score += 10;
                else if (string.IsNullOrWhiteSpace(nr.Name) && MessageMentionsProduct(message, pp.Name)) score += 8;
                else if (string.IsNullOrWhiteSpace(nr.Name)) score += 3; // nameless fallback when single missing

                if (pp.MissingFields.Count > 0) score += 3; // prioritize missing but not exclusive
                if (!string.IsNullOrWhiteSpace(nr.Sku)) score += 2;
                if (nr.Price != null) score += 2;
                if (MessageMentionsProduct(message, pp.Name)) score += 5;

                if (score > bestScore) { bestScore = score; bestIdx = i; }
            }

            // Edge: if nr.Name empty and no bestIdx but single missing exists, target that missing
            if (bestIdx < 0 && string.IsNullOrWhiteSpace(nr.Name))
            {
                var missingIdxFallback = pending.Proposals.FindIndex(p => p.MissingFields.Count > 0 && !usedIndices.Contains(pending.Proposals.IndexOf(p)));
                // try generic single-missing fallback
                if (missingIdxFallback >= 0 && pending.Proposals.Count(p => p.MissingFields.Count > 0) == 1)
                    bestIdx = missingIdxFallback;
                else if (pending.Proposals.Count == 1 && !usedIndices.Contains(0))
                    bestIdx = 0;
            }

            if (bestIdx >= 0)
            {
                var pr = patchedRaws[bestIdx];
                var applyStockDelta = hasStockMovementIntent &&
                    (pending.Proposals.Count == 1 || MessageMentionsProduct(message, pending.Proposals[bestIdx].Name));
                var merged = new RawProductExtract(
                    Name: !string.IsNullOrWhiteSpace(nr.Name) ? nr.Name!.Trim() : pr.Name,
                    Sku: !string.IsNullOrWhiteSpace(nr.Sku) ? nr.Sku!.Trim().ToUpperInvariant() : pr.Sku,
                    Price: nr.Price ?? pr.Price,
                    StockDelta: applyStockDelta ? nr.StockDelta ?? pr.StockDelta : pr.StockDelta,
                    Barcode: !string.IsNullOrWhiteSpace(nr.Barcode) ? nr.Barcode : pr.Barcode,
                    Description: !string.IsNullOrWhiteSpace(nr.Description) ? nr.Description : pr.Description,
                    CategoryNames: nr.CategoryNames ?? pr.CategoryNames,
                    StockDirectionRequired: pr.StockDirectionRequired &&
                        !(applyStockDelta && nr.StockDelta.HasValue && AssistantProductExtractor.HasExplicitStockDirection(message))
                );
                if (merged.Sku != pr.Sku || merged.Price != pr.Price || merged.Name != pr.Name || merged.StockDelta != pr.StockDelta || merged.Barcode != pr.Barcode)
                    anyPatched = true;
                else
                    anyPatched = true; // still counts as patched intent (even if same, avoid null return when mapping succeeded)
                patchedRaws[bestIdx] = merged;
                usedIndices.Add(bestIdx);
            }
        }

        // Final fallback: if still not patched and we have a single newRaw with data, try single-missing patch (covers Azúcar inferencia)
        if (!anyPatched && newRaws.Count == 1)
        {
            var nr = newRaws[0];
            if (!string.IsNullOrWhiteSpace(nr.Sku) || nr.Price != null)
            {
                var missingIndices = pending.Proposals.Select((p, idx) => new { p, idx }).Where(x => x.p.MissingFields.Count > 0).Select(x => x.idx).ToList();
                if (missingIndices.Count == 1)
                {
                    var idx = missingIndices[0];
                    if (!usedIndices.Contains(idx))
                    {
                        var applyStockDelta = hasStockMovementIntent &&
                            (pending.Proposals.Count == 1 || MessageMentionsProduct(message, pending.Proposals[idx].Name));
                        bool ok = string.IsNullOrWhiteSpace(nr.Name) || NamesMatch(nr.Name, pending.Proposals[idx].Name) ||
                            pending.Proposals[idx].MissingFields.Contains("Name") || MessageMentionsProduct(message, pending.Proposals[idx].Name);
                        // For single missing, allow even without explicit mention (inferencia válida)
                        if (string.IsNullOrWhiteSpace(nr.Name)) ok = true;
                        if (ok)
                        {
                            var pr = patchedRaws[idx];
                            patchedRaws[idx] = new RawProductExtract(
                                !string.IsNullOrWhiteSpace(nr.Name) ? nr.Name!.Trim() : pr.Name,
                                !string.IsNullOrWhiteSpace(nr.Sku) ? nr.Sku!.Trim().ToUpperInvariant() : pr.Sku,
                                nr.Price ?? pr.Price,
                                applyStockDelta ? nr.StockDelta ?? pr.StockDelta : pr.StockDelta,
                                pr.Barcode, pr.Description, nr.CategoryNames ?? pr.CategoryNames,
                                pr.StockDirectionRequired &&
                                    !(applyStockDelta && nr.StockDelta.HasValue && AssistantProductExtractor.HasExplicitStockDirection(message)));
                            anyPatched = true;
                        }
                    }
                }
            }
        }

        if (!anyPatched) return null;
        return await BuildFromRawsAsync(patchedRaws, businessId, ct,
            exactSkuOnly: pending.RequireExactSkuMatch,
            blockInactiveProducts: pending.RequireExactSkuMatch);
    }

    private async Task<ProposalResponse?> BuildFromRawsAsync(
        List<RawProductExtract> rawList,
        Guid businessId,
        CancellationToken ct,
        bool exactSkuOnly = false,
        bool blockInactiveProducts = false)
    {
        if (rawList == null || rawList.Count == 0) return null;
        var proposals = new List<ProductProposal>();
        var duplicateSkus = FindDuplicateSkus(rawList);

        foreach (var raw in rawList)
        {
            // Tolerant existence search: exact Sku, then tolerant Name LIKE %name% / viceversa, singular/plural, tokens
            Product? existing = null;
            var ambiguousSkuMatch = false;
            if (!string.IsNullOrWhiteSpace(raw.Sku))
            {
                var skuNorm = raw.Sku.Trim().ToLowerInvariant();
                var skuMatches = await _db.Products
                    .IgnoreQueryFilters()
                    .Include(p => p.Categories)
                    .Where(p => p.BusinessId == businessId && p.Sku.ToLower() == skuNorm)
                    .Take(2)
                    .ToListAsync(ct);
                existing = skuMatches.Count == 1 ? skuMatches[0] : null;
                ambiguousSkuMatch = skuMatches.Count > 1;
            }
            if (ShouldUseTolerantNameMatch(exactSkuOnly, ambiguousSkuMatch, existing, raw.Sku, raw.Name) &&
                !string.IsNullOrWhiteSpace(raw.Name))
            {
                var nameNorm = raw.Name.Trim().ToLowerInvariant();
                var nameNormSingular = nameNorm.EndsWith("s") && nameNorm.Length > 1 ? nameNorm[..^1] : nameNorm;

                // Tokens singularizados; incluye números ("3") aunque Length==1 para no perder unidades.
                var tokens = nameNorm.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Select(t => t.EndsWith("s") && t.Length > 1 ? t[..^1] : t)
                    .Where(t => t.Length >= 2 || int.TryParse(t, out _))
                    .ToList();

                // Query candidates with tolerant LIKE both directions + singular variant
                var candidates = await _db.Products
                    .IgnoreQueryFilters()
                    .Include(p => p.Categories)
                    .Where(p =>
                        p.BusinessId == businessId &&
                        (EF.Functions.Like(p.Name.ToLower(), $"%{nameNorm}%") ||
                         EF.Functions.Like(p.Name.ToLower(), $"%{nameNormSingular}%") ||
                         EF.Functions.Like(nameNorm, "%" + p.Name.ToLower() + "%") ||
                         EF.Functions.Like(nameNormSingular, "%" + p.Name.ToLower() + "%")))
                    .ToListAsync(ct);

                // Fallback: if LIKE yielded nothing, broaden to token-based search client-side
                if (candidates.Count == 0 && tokens.Count > 0)
                {
                    var all = await _db.Products.IgnoreQueryFilters().Include(p => p.Categories).Where(p => p.BusinessId == businessId).ToListAsync(ct);
                    candidates = all.Where(p =>
                    {
                        var pn = p.Name.ToLowerInvariant();
                        return tokens.Count(t => pn.Contains(t)) >= 1;
                    }).ToList();
                }

                if (candidates.Count > 0)
                {
                    // Umbral anti-falso-positivo: evita que "Gaseosa Seven Up 3 Litros" matchee "Gaseosa Pepsi"
                    // solo por token genérico "gaseosa". Requiere containsAll o >=2 tokens con al menos 1 distintivo no genérico.
                    var genericTokens = new HashSet<string>(StringComparer.OrdinalIgnoreCase)
                    {
                        "gaseosa","bebida","yerba","azucar","manteca","leche","aceite","harina","producto","litro","litros","kilo","kilos","gramo","paquete"
                    };
                    const int threshold = 30; // containsAll=100 pasa; 2 tokens=20+2 activo=22 no pasa sin distintivo -> necesita 3 tokens o distintivo

                    Product? best = null;
                    int bestScore = -1;
                    bool bestContainsAll = false;
                    int bestTotalMatches = 0;
                    int bestDistinctiveMatches = 0;

                    foreach (var c in candidates)
                    {
                        var pn = c.Name.ToLowerInvariant();
                        var pnSing = pn.EndsWith("s") && pn.Length > 1 ? pn[..^1] : pn;
                        int score = 0;
                        bool containsAll = tokens.Count > 0 && tokens.All(t => pn.Contains(t) || pnSing.Contains(t));
                        if (containsAll) score += 100;
                        foreach (var t in tokens)
                        {
                            if (pn.Contains(t) || pnSing.Contains(t)) score += 10;
                        }
                        // shorter distance to input preferred
                        score -= Math.Abs(pn.Length - nameNorm.Length) / 5;
                        if (c.IsActive) score += 2;
                        if (score > bestScore)
                        {
                            bestScore = score;
                            best = c;
                            bestContainsAll = containsAll;
                            bestTotalMatches = tokens.Count(t => pn.Contains(t) || pnSing.Contains(t));
                            bestDistinctiveMatches = tokens.Count(t => !genericTokens.Contains(t) && t.Length >= 4 && (pn.Contains(t) || pnSing.Contains(t)));
                        }
                    }

                    // Solo acepta existing si pasa evidencia: containsAll o (>=2 matches con 1 distintivo) o score >= threshold
                    bool passesThreshold = false;
                    if (best != null)
                    {
                        if (bestContainsAll) passesThreshold = true;
                        else if (bestTotalMatches >= 2 && bestDistinctiveMatches >= 1) passesThreshold = true;
                        else if (bestScore >= threshold) passesThreshold = true;
                    }

                    existing = passesThreshold ? best : null;
                }
            }

            var proposal = BuildProposalRow(raw, existing,
                !string.IsNullOrWhiteSpace(raw.Sku) && duplicateSkus.Contains(raw.Sku.Trim()),
                ambiguousSkuMatch,
                blockInactiveProducts);
            if (proposal != null) proposals.Add(proposal);
        }

        if (proposals.Count == 0) return null;

        bool hasMissing = proposals.Any(p => p.MissingFields.Count > 0);
        bool needsConfirmation = !hasMissing && proposals.Any(p => p.Action != null);

        var natural = BuildNaturalReply(proposals);

        return new ProposalResponse(proposals, natural, needsConfirmation, hasMissing, exactSkuOnly);
    }

    public static bool HasActionableExistingChanges(decimal? currentPrice, decimal? requestedPrice, decimal? stockDelta, bool hasCategoryChanges) =>
        stockDelta.GetValueOrDefault() != 0 ||
        requestedPrice.HasValue && requestedPrice != currentPrice ||
        hasCategoryChanges;

    public static HashSet<string> FindDuplicateSkus(IReadOnlyList<RawProductExtract> rawList) => rawList
        .Where(raw => !string.IsNullOrWhiteSpace(raw.Sku))
        .GroupBy(raw => raw.Sku!.Trim(), StringComparer.OrdinalIgnoreCase)
        .Where(group => group.Count() > 1)
        .Select(group => group.Key)
        .ToHashSet(StringComparer.OrdinalIgnoreCase);

    public static bool ShouldUseTolerantNameMatch(
        bool exactSkuOnly,
        bool ambiguousSkuMatch,
        Product? exactSkuMatch,
        string? proposedSku,
        string? name) =>
        !exactSkuOnly && !ambiguousSkuMatch && exactSkuMatch is null &&
        string.IsNullOrWhiteSpace(proposedSku) && !string.IsNullOrWhiteSpace(name);

    public static bool DoesExistingSkuMatch(string? proposedSku, string? currentSku) =>
        !string.IsNullOrWhiteSpace(proposedSku) && !string.IsNullOrWhiteSpace(currentSku) &&
        string.Equals(proposedSku.Trim(), currentSku.Trim(), StringComparison.OrdinalIgnoreCase);

    private static readonly CreateProductDtoValidator ProductValidator = new();
    private const decimal MaxProductPrice = 9_999_999_999_999_999.99m;
    private const decimal MaxProductStock = 999_999_999m;

    public static ProductProposal? BuildProposalRow(
        RawProductExtract raw,
        Product? existing,
        bool duplicateSku = false,
        bool ambiguousSkuMatch = false,
        bool blockInactiveProduct = false)
    {
        var exists = existing != null;
        var missing = new List<string>();
        if (duplicateSku) missing.Add("SKU duplicado en la lista");
        if (ambiguousSkuMatch) missing.Add("SKU duplicado en el inventario");

        var requestedPrice = raw.Price;
        if (requestedPrice is { } price && price < 0)
        {
            missing.Add("El precio no puede ser negativo");
            requestedPrice = null;
        }
        else if (requestedPrice is { } value && (value > MaxProductPrice || decimal.Round(value, 2) != value))
        {
            missing.Add("Precio (debe caber en decimal(18,2))");
            requestedPrice = null;
        }

        decimal? stockDelta = exists && raw.ExplicitStockDelta.HasValue ? raw.ExplicitStockDelta : raw.StockDelta;
        if (exists)
        {
            if (raw.StockDirectionRequired && !raw.ExplicitStockDelta.HasValue)
            {
                missing.Add("Dirección de stock");
                stockDelta = null;
            }
            else if (stockDelta == 0)
            {
                stockDelta = null;
            }

            if (stockDelta is { } delta &&
                (decimal.Round(delta, 3) != delta || existing!.Stock + delta < 0 || existing.Stock + delta > MaxProductStock))
            {
                missing.Add("Stock (ajuste fuera del rango permitido)");
                stockDelta = null;
            }

            if (!string.IsNullOrWhiteSpace(raw.Name) && raw.Name.Trim().Length > 50)
                missing.Add("El nombre del producto no puede exceder los 50 caracteres");
            if (requestedPrice.HasValue && requestedPrice != existing!.Price && raw.Description?.Length > 200)
                missing.Add("La descripción no puede exceder los 200 caracteres");
            if (!string.IsNullOrWhiteSpace(raw.Sku) && !DoesExistingSkuMatch(raw.Sku, existing!.Sku))
                missing.Add("El SKU no coincide con el producto encontrado");
            if ((blockInactiveProduct || raw.BlockInactiveProduct) && !existing!.IsActive)
                missing.Add("Producto inactivo; su reactivación debe realizarla un administrador");

            if (!HasActionableExistingChanges(existing!.Price, requestedPrice, stockDelta, raw.CategoryNames?.Count > 0) &&
                missing.Count == 0)
                return null;

            var action = requestedPrice.HasValue && requestedPrice != existing.Price
                ? "restock+price_update"
                : "restock";
            return new ProductProposal(
                Name: string.IsNullOrWhiteSpace(raw.Name) ? existing.Name : raw.Name.Trim(),
                Sku: string.IsNullOrWhiteSpace(raw.Sku) ? existing.Sku : raw.Sku.Trim().ToUpperInvariant(),
                Price: requestedPrice,
                StockDelta: stockDelta,
                Barcode: raw.Barcode,
                Description: raw.Description,
                CategoryNames: raw.CategoryNames,
                Exists: true,
                ExistingId: existing.Id,
                CurrentPrice: existing.Price,
                CurrentStock: existing.Stock,
                MissingFields: missing.Distinct(StringComparer.Ordinal).ToList(),
                Action: action);
        }

        var name = raw.Name?.Trim() ?? string.Empty;
        if (string.IsNullOrWhiteSpace(raw.Sku)) missing.Add("Sku");
        if (string.IsNullOrWhiteSpace(name)) missing.Add("Name");
        if (raw.Price == null) missing.Add("Price");
        if (raw.StockDelta is not { } initialStock) missing.Add("Stock");
        else if (initialStock <= 0 || initialStock > MaxProductStock || decimal.Round(initialStock, 3) != initialStock)
            missing.Add("Stock (debe ser >0, <=999999999 y tener hasta 3 decimales)");
        if (raw.Barcode?.Length > 100) missing.Add("El código de barras no puede exceder los 100 caracteres");
        if (raw.Description?.Length > 200) missing.Add("La descripción no puede exceder los 200 caracteres");

        var createDto = new CreateProductDto(raw.Sku?.Trim() ?? string.Empty, name, raw.Price ?? 0m,
            raw.Barcode, raw.Description, null, null, null);
        missing.AddRange(ProductValidator.Validate(createDto).Errors.Select(error => error.ErrorMessage));
        if (raw.Price is { } createPrice && (createPrice > MaxProductPrice || decimal.Round(createPrice, 2) != createPrice))
            missing.Add("Precio (debe caber en decimal(18,2))");

        return new ProductProposal(
            Name: string.IsNullOrWhiteSpace(name) ? "Producto sin identificar" : name,
            Sku: raw.Sku?.Trim().ToUpperInvariant(),
            Price: raw.Price,
            StockDelta: raw.StockDelta,
            Barcode: raw.Barcode,
            Description: raw.Description,
            CategoryNames: raw.CategoryNames,
            Exists: false,
            ExistingId: null,
            CurrentPrice: null,
            CurrentStock: null,
            MissingFields: missing.Distinct(StringComparer.Ordinal).ToList(),
            Action: "create");
    }

    private string BuildNaturalReply(List<ProductProposal> proposals)
    {
        var sb = new StringBuilder();
        var hasMissing = proposals.Any(p => p.MissingFields.Count > 0);

        // Single proposal -> conversational single line
        if (proposals.Count == 1)
        {
            var p = proposals[0];
            var formattedDelta = AssistantInventoryContext.FormatStockChange(p.StockDelta);
            var stockPart = formattedDelta == "sin delta" ? formattedDelta : $"{formattedDelta} unidades";
            var currentPart = p.CurrentStock != null ? $" (stock actual: {AssistantInventoryContext.FormatStock(p.CurrentStock.Value)})" : "";
            if (p.Exists && p.MissingFields.Count == 0)
            {
                var confirmation = p.StockDelta < 0
                    ? "¿Confirmás el descuento de stock?"
                    : p.StockDelta > 0 ? "¿Confirmás la reposición?" : "¿Confirmás los cambios?";
                sb.AppendLine($"Detecté **{p.Name}**: {stockPart}{currentPart}. {confirmation} Podés tocar **Confirmar** o **Corregir** abajo, o decímelo escribiendo (\"sí, dale\").");
            }
            else if (!p.Exists && p.MissingFields.Count > 0)
            {
                var deltaStr = p.StockDelta is { } delta && delta != 0 ? $" ({AssistantInventoryContext.FormatStockChange(delta)})" : "";
                sb.AppendLine($"Detecté **{p.Name}**{deltaStr}. No lo encontré en tu inventario — para crearlo necesito: {string.Join(", ", p.MissingFields)}. ¿Me los pasás? Ej: \"SKU CEP200 a $1200\"");
            }
            else if (!p.Exists && p.MissingFields.Count == 0)
            {
                var priceStr = p.Price != null ? $" a ${p.Price}" : "";
                sb.AppendLine($"Detecté **{p.Name}**{priceStr} {stockPart}. No existe en inventario, se creará nuevo. ¿Te parece bien? Podés tocar **Confirmar** o **Corregir** abajo, o decímelo escribiendo.");
            }
            else
            {
                // fallback single
                sb.AppendLine($"Detecté **{p.Name}**: {stockPart}{currentPart}.");
                if (!hasMissing)
                    sb.AppendLine("¿Te parece bien? Podés tocar **Confirmar** o **Corregir** abajo, o decímelo escribiendo (\"sí, dale\").");
                else
                    sb.AppendLine($"Faltan: {string.Join(", ", p.MissingFields)}.");
            }
            return sb.ToString().Trim();
        }

        // Multiple or mixed -> bullet list, never pipes
        sb.AppendLine("Entendí lo siguiente:");
        foreach (var p in proposals)
        {
            var estado = p.Exists
                ? p.StockDelta < 0 ? "existe, descontar stock" : p.StockDelta > 0 ? "existe, reponer" : "existe, actualizar"
                : "nuevo, crear";
            var stock = AssistantInventoryContext.FormatStockChange(p.StockDelta);
            var falt = p.MissingFields.Count > 0 ? $" — faltan: {string.Join(", ", p.MissingFields)}" : "";
            var cur = p.Exists && p.CurrentStock != null ? $" (actual: {AssistantInventoryContext.FormatStock(p.CurrentStock.Value)})" : "";
            sb.AppendLine($"• {p.Name} — {stock}{cur} ({estado}){falt}");
        }
        sb.AppendLine();
        if (hasMissing)
        {
            sb.AppendLine("⚠️ Faltan datos obligatorios para crear los marcados arriba. Decime los que faltan y vuelvo a proponer.");
        }
        else
        {
            sb.AppendLine("¿Te parece bien? Podés tocar **Confirmar** o **Corregir** abajo, o decímelo escribiendo.");
        }
        return sb.ToString().Trim();
    }

    public async Task<string> ExecuteAsync(ProposalResponse proposal, Guid businessId, CancellationToken ct)
    {
        if (!proposal.NeedsConfirmation || proposal.HasMissingData || proposal.Proposals.Count == 0 ||
            proposal.Proposals.Any(p => p.MissingFields.Count > 0))
            throw new InvalidOperationException("La propuesta no está completa y lista para confirmar.");

        var duplicateSkus = proposal.Proposals
            .Where(p => !string.IsNullOrWhiteSpace(p.Sku))
            .GroupBy(p => p.Sku!.Trim(), StringComparer.OrdinalIgnoreCase)
            .Any(group => group.Count() > 1);
        if (duplicateSkus)
            throw new InvalidOperationException("La propuesta contiene SKU duplicados y no se ejecutó.");

        await using var transaction = await _db.Database.BeginTransactionAsync(IsolationLevel.Serializable, ct);
        return await ExecuteAtomicallyAsync(transaction.CommitAsync, transaction.RollbackAsync, async () =>
        {
            var createSkus = proposal.Proposals.Where(p => !p.Exists).Select(p => p.Sku!).ToList();
            if (createSkus.Count > 0 && await _db.Products.IgnoreQueryFilters()
                    .AnyAsync(p => p.BusinessId == businessId && createSkus.Contains(p.Sku), ct))
                throw new InvalidOperationException("Un SKU de la propuesta ya existe en el inventario. Volvé a generar la propuesta.");

            var existingIds = proposal.Proposals.Where(p => p.Exists).Select(p => p.ExistingId!.Value).Distinct().ToList();
            if (existingIds.Count > 0)
            {
                var actualSkus = await _db.Products.IgnoreQueryFilters()
                    .Where(p => p.BusinessId == businessId && existingIds.Contains(p.Id))
                    .ToDictionaryAsync(p => p.Id, p => new { p.Sku, p.IsActive }, ct);
                if (actualSkus.Count != existingIds.Count || proposal.Proposals
                        .Where(p => p.Exists)
                        .Any(p => !actualSkus.TryGetValue(p.ExistingId!.Value, out var actualSku) ||
                            !DoesExistingSkuMatch(p.Sku, actualSku.Sku)))
                    throw new InvalidOperationException("El SKU o la pertenencia del producto cambió desde la propuesta. Volvé a generarla.");
                if (proposal.RequireExactSkuMatch && actualSkus.Values.Any(product => !product.IsActive))
                    throw new InvalidOperationException("Un producto de la propuesta está inactivo. Un administrador debe reactivarlo antes de continuar.");
            }

            var sb = new StringBuilder();
            foreach (var p in proposal.Proposals)
            {
                if (!p.Exists)
                {
                    var created = await _productService.CreateAsync(new CreateProductDto(
                        Sku: p.Sku!,
                        Name: p.Name,
                        Price: p.Price!.Value,
                        Barcode: p.Barcode,
                        Description: p.Description,
                        ImageUrl: null,
                        Unit: null,
                        MinStock: null
                    ), businessId);
                    // Adjust stock if delta >0
                    if (p.StockDelta.HasValue && p.StockDelta.Value > 0)
                    {
                        await _productService.AdjustStockAsync(created.Id, new StockAdjustmentDto(p.StockDelta.Value, "Reposición vía asistente"), businessId);
                    }
                    // Categories
                    if (p.CategoryNames != null && p.CategoryNames.Count > 0)
                    {
                        foreach (var catName in p.CategoryNames)
                        {
                            var cat = await EnsureCategoryAsync(catName, ct);
                            await _categoryService.AssignProductAsync(cat.Id, created.Id);
                        }
                    }
                    sb.AppendLine($"- ✅ Creado {p.Name} (SKU {p.Sku}) precio {p.Price} stock {AssistantInventoryContext.FormatStockChange(p.StockDelta)}");
                }
                else
                {
                    var id = p.ExistingId!.Value;
                    var productEntity = await _db.Products.IgnoreQueryFilters().FirstOrDefaultAsync(x => x.Id == id && x.BusinessId == businessId, ct);
                    if (productEntity == null)
                        throw new KeyNotFoundException($"No se encontró ningún producto con el ID: {id}");
                    if (!productEntity.IsActive)
                    {
                        productEntity.Activate();
                        await _db.SaveChangesAsync(ct);
                        _logger.LogInformation("Producto reactivado {ProductId} {Name} vía asistente", id, productEntity.Name);
                    }
                    // Price update if needed
                    if (p.Price != null && p.Price != p.CurrentPrice)
                    {
                        // Need existing description for Update: keep existing if not provided (reuse reactivated entity)
                        var desc = p.Description ?? productEntity.Description;
                        // Use raw name if provided otherwise existing name
                        var nameForUpdate = !string.IsNullOrWhiteSpace(p.Name) ? p.Name : productEntity.Name;
                        await _productService.UpdateAsync(id, new UpdateProductDto(nameForUpdate, p.Price.Value, desc, null, null, null), businessId);
                        sb.AppendLine($"- ✅ Precio actualizado {p.Name}: {p.CurrentPrice} → {p.Price}");
                    }
                    if (p.StockDelta.HasValue && p.StockDelta.Value != 0)
                    {
                        var delta = p.StockDelta.Value;
                        var reason = delta < 0 ? "Descuento vía asistente" : "Reposición vía asistente";
                        var action = delta < 0 ? "Stock descontado" : "Stock repuesto";
                        await _productService.AdjustStockAsync(id, new StockAdjustmentDto(delta, reason), businessId);
                        sb.AppendLine($"- ✅ {action} {p.Name}: {AssistantInventoryContext.FormatStockChange(delta)} (antes {AssistantInventoryContext.FormatStock(p.CurrentStock!.Value)})");
                    }
                    else if (p.Price == null || p.Price == p.CurrentPrice)
                    {
                        // If no price change and no stock delta, at least report
                        if (!p.StockDelta.HasValue)
                            sb.AppendLine($"- ℹ️ {p.Name}: sin delta de stock, no se ajustó");
                    }
                    // Categories for existing
                    if (p.CategoryNames != null && p.CategoryNames.Count > 0)
                    {
                        // need id
                        var prodId = id;
                        foreach (var catName in p.CategoryNames)
                        {
                            var cat = await EnsureCategoryAsync(catName, ct);
                            await _categoryService.AssignProductAsync(cat.Id, prodId);
                        }
                        sb.AppendLine($"- ✅ Categoría asignada {p.Name}: {string.Join(", ", p.CategoryNames)}");
                    }
                }
            }
            return sb.Length == 0 ? "No se ejecutó ninguna acción." : sb.ToString().Trim();
        }, ct);
    }

    public static async Task<T> ExecuteAtomicallyAsync<T>(
        Func<CancellationToken, Task> commit,
        Func<CancellationToken, Task> rollback,
        Func<Task<T>> action,
        CancellationToken ct)
    {
        T result;
        try
        {
            result = await action();
        }
        catch (Exception actionFailure)
        {
            try
            {
                await rollback(CancellationToken.None);
            }
            catch (Exception rollbackFailure)
            {
                throw new AssistantProposalOutcomeUnknownException(
                    "Proposal action failed and its transaction rollback could not be confirmed.",
                    new AggregateException(actionFailure, rollbackFailure));
            }
            throw;
        }

        try
        {
            await commit(ct);
            return result;
        }
        catch (Exception commitFailure)
        {
            Exception failure = commitFailure;
            try
            {
                await rollback(CancellationToken.None);
            }
            catch (Exception rollbackFailure)
            {
                failure = new AggregateException(commitFailure, rollbackFailure);
            }
            throw new AssistantProposalOutcomeUnknownException(
                "Proposal commit failed; the transaction outcome is unknown.", failure);
        }
    }

    private async Task<Category> EnsureCategoryAsync(string name, CancellationToken ct)
    {
        var norm = name.Trim();
        var existing = await _db.Categories
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Name.ToLower() == norm.ToLower(), ct);
        if (existing != null)
        {
            if (!existing.IsActive)
            {
                existing.Activate();
                await _db.SaveChangesAsync(ct);
            }
            return existing;
        }
        var cat = new Category(norm, null);
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return cat;
    }
}
