using System.Text;
using MetraTC.Application.Services;
using MetraTC.Domain.Entities;
using MetraTC.Infrastructure.Persistence;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using static MetraTC.Application.DTOs.AssistantDtos;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Services.Assistant;

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

    public async Task<ProposalResponse?> BuildProposalAsync(string message, IReadOnlyList<ChatMessage> history, string inventoryContext, CancellationToken ct)
    {
        var rawList = await _extractor.ExtractAsync(message, history, inventoryContext, ct);
        if (rawList == null || rawList.Count == 0) return null;

        var proposals = new List<ProductProposal>();

        foreach (var raw in rawList)
        {
            // Tolerant existence search: exact Sku, then tolerant Name LIKE %name% / viceversa, singular/plural, tokens
            Product? existing = null;
            if (!string.IsNullOrWhiteSpace(raw.Sku))
            {
                var skuNorm = raw.Sku.Trim().ToLowerInvariant();
                existing = await _db.Products
                    .IgnoreQueryFilters()
                    .Include(p => p.Categories)
                    .FirstOrDefaultAsync(p => p.Sku.ToLower() == skuNorm, ct);
            }
            if (existing == null && !string.IsNullOrWhiteSpace(raw.Name))
            {
                var nameNorm = raw.Name.Trim().ToLowerInvariant();
                var nameNormSingular = nameNorm.EndsWith("s") && nameNorm.Length > 1 ? nameNorm[..^1] : nameNorm;

                // Prepare tokens for ranking (singularized)
                var tokens = nameNorm.Split(' ', StringSplitOptions.RemoveEmptyEntries)
                    .Select(t => t.EndsWith("s") && t.Length > 1 ? t[..^1] : t)
                    .Where(t => t.Length >= 2)
                    .ToList();

                // Query candidates with tolerant LIKE both directions + singular variant
                var candidates = await _db.Products
                    .IgnoreQueryFilters()
                    .Include(p => p.Categories)
                    .Where(p =>
                        EF.Functions.Like(p.Name.ToLower(), $"%{nameNorm}%") ||
                        EF.Functions.Like(p.Name.ToLower(), $"%{nameNormSingular}%") ||
                        EF.Functions.Like(nameNorm, "%" + p.Name.ToLower() + "%") ||
                        EF.Functions.Like(nameNormSingular, "%" + p.Name.ToLower() + "%"))
                    .ToListAsync(ct);

                // Fallback: if LIKE yielded nothing, broaden to token-based search client-side
                if (candidates.Count == 0 && tokens.Count > 0)
                {
                    var all = await _db.Products.IgnoreQueryFilters().Include(p => p.Categories).ToListAsync(ct);
                    candidates = all.Where(p =>
                    {
                        var pn = p.Name.ToLowerInvariant();
                        return tokens.Any(t => pn.Contains(t));
                    }).ToList();
                }

                if (candidates.Count > 0)
                {
                    // Rank by best coincidence: contains all tokens wins
                    Product? best = null;
                    int bestScore = -1;
                    foreach (var c in candidates)
                    {
                        var pn = c.Name.ToLowerInvariant();
                        var pnSing = pn.EndsWith("s") && pn.Length > 1 ? pn[..^1] : pn;
                        int score = 0;
                        bool containsAll = tokens.Count > 0 && tokens.All(t => pn.Contains(t) || pnSing.Contains(t));
                        if (containsAll) score += 100;
                        foreach (var t in tokens)
                        {
                            if (pn.Contains(t)) score += 10;
                        }
                        // shorter distance to input preferred
                        score -= Math.Abs(pn.Length - nameNorm.Length) / 5;
                        if (c.IsActive) score += 2;
                        if (score > bestScore)
                        {
                            bestScore = score;
                            best = c;
                        }
                    }
                    existing = best ?? candidates.FirstOrDefault();
                }
            }

            bool exists = existing != null;
            Guid? existingId = existing?.Id;
            decimal? currentPrice = existing?.Price;
            int? currentStock = existing?.Stock;

            var missing = new List<string>();
            string action;

            if (!exists)
            {
                // For create: require Sku, Name, Price, StockDelta
                if (string.IsNullOrWhiteSpace(raw.Sku)) missing.Add("Sku");
                if (string.IsNullOrWhiteSpace(raw.Name)) missing.Add("Name");
                if (raw.Price == null) missing.Add("Price");
                if (raw.StockDelta == null) missing.Add("Stock");
                else if (raw.StockDelta <= 0) missing.Add("Stock (debe ser >0)");
                // Barcode/description/categories are optional
                action = "create";
            }
            else
            {
                // Exists: optional price change detection — never ask Sku/Price
                if (raw.Price != null && raw.Price != currentPrice)
                    action = "restock+price_update";
                else
                    action = "restock";
                // MissingFields must stay empty for existing products (no pedir SKU/Price)
                // StockDelta is optional; execution will simply not adjust if null/0
            }

            var nameVal = raw.Name?.Trim() ?? (exists ? existing!.Name : "");
            // Ensure Name not empty for create; for exists we keep existing name if raw name missing? But spec says Name is product identifier
            if (exists && string.IsNullOrWhiteSpace(nameVal)) nameVal = existing!.Name;

            proposals.Add(new ProductProposal(
                Name: nameVal,
                Sku: raw.Sku?.Trim()?.ToUpperInvariant(),
                Price: raw.Price,
                StockDelta: raw.StockDelta,
                Barcode: raw.Barcode,
                Description: raw.Description,
                CategoryNames: raw.CategoryNames,
                Exists: exists,
                ExistingId: existingId,
                CurrentPrice: currentPrice,
                CurrentStock: currentStock,
                MissingFields: missing,
                Action: action
            ));
        }

        if (proposals.Count == 0) return null;

        bool hasMissing = proposals.Any(p => p.MissingFields.Count > 0);
        bool needsConfirmation = !hasMissing && proposals.Any(p => p.Action != null);

        var natural = BuildNaturalReply(proposals);

        return new ProposalResponse(proposals, natural, needsConfirmation, hasMissing);
    }

    private string BuildNaturalReply(List<ProductProposal> proposals)
    {
        var sb = new StringBuilder();
        var hasMissing = proposals.Any(p => p.MissingFields.Count > 0);

        // Single proposal -> conversational single line
        if (proposals.Count == 1)
        {
            var p = proposals[0];
            var stockPart = p.StockDelta != null ? $"+{p.StockDelta} unidades" : "sin delta";
            var currentPart = p.CurrentStock != null ? $" (stock actual: {p.CurrentStock})" : "";
            if (p.Exists && p.MissingFields.Count == 0)
            {
                sb.AppendLine($"Detecté **{p.Name}**: {stockPart}{currentPart}. ¿Confirmás la reposición? Decime \"sí, dale\" para ejecutar o decime qué corregir.");
            }
            else if (!p.Exists && p.MissingFields.Count > 0)
            {
                var deltaStr = p.StockDelta != null ? $" (+{p.StockDelta})" : "";
                sb.AppendLine($"Detecté **{p.Name}**{deltaStr}. No lo encontré en tu inventario — para crearlo necesito: {string.Join(", ", p.MissingFields)}. ¿Me los pasás? Ej: \"SKU CEP200 a $1200\"");
            }
            else if (!p.Exists && p.MissingFields.Count == 0)
            {
                var priceStr = p.Price != null ? $" a ${p.Price}" : "";
                sb.AppendLine($"Detecté **{p.Name}**{priceStr} {stockPart}. No existe en inventario, se creará nuevo. ¿Te parece bien? Decime \"sí, dale\" para confirmar o decime qué corregir.");
            }
            else
            {
                // fallback single
                sb.AppendLine($"Detecté **{p.Name}**: {stockPart}{currentPart}.");
                if (!hasMissing)
                    sb.AppendLine("¿Te parece bien? Decime \"sí, dale\" para confirmar o decime qué corregir (ej: \"no, la coca es 1500 no 1600\" o \"el sku está mal\").");
                else
                    sb.AppendLine($"Faltan: {string.Join(", ", p.MissingFields)}.");
            }
            return sb.ToString().Trim();
        }

        // Multiple or mixed -> bullet list, never pipes
        sb.AppendLine("Entendí lo siguiente:");
        foreach (var p in proposals)
        {
            var estado = p.Exists ? "existe, reponer" : "nuevo, crear";
            var stock = p.StockDelta != null ? $"+{p.StockDelta}" : "sin delta";
            var falt = p.MissingFields.Count > 0 ? $" — faltan: {string.Join(", ", p.MissingFields)}" : "";
            var cur = p.Exists && p.CurrentStock != null ? $" (actual: {p.CurrentStock})" : "";
            sb.AppendLine($"• {p.Name} — {stock}{cur} ({estado}){falt}");
        }
        sb.AppendLine();
        if (hasMissing)
        {
            sb.AppendLine("⚠️ Faltan datos obligatorios para crear los marcados arriba. Decime los que faltan y vuelvo a proponer.");
        }
        else
        {
            sb.AppendLine("¿Te parece bien? Decime \"sí, dale\" para confirmar o decime qué corregir (ej: \"no, la coca es 1500 no 1600\" o \"el sku está mal\").");
        }
        return sb.ToString().Trim();
    }

    public async Task<string> ExecuteAsync(ProposalResponse proposal, CancellationToken ct)
    {
        var sb = new StringBuilder();
        foreach (var p in proposal.Proposals)
        {
            if (p.MissingFields.Count > 0)
            {
                sb.AppendLine($"- {p.Name}: no ejecutado, faltan {string.Join(", ", p.MissingFields)}");
                continue;
            }

            try
            {
                if (!p.Exists)
                {
                    // Create
                    var created = await _productService.CreateAsync(new CreateProductDto(
                        Sku: p.Sku!,
                        Name: p.Name,
                        Price: p.Price!.Value,
                        Barcode: p.Barcode,
                        Description: p.Description
                    ));
                    // Adjust stock if delta >0
                    if (p.StockDelta.HasValue && p.StockDelta.Value > 0)
                    {
                        await _productService.AdjustStockAsync(created.Id, new StockAdjustmentDto(p.StockDelta.Value, "Reposición vía asistente"));
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
                    sb.AppendLine($"- ✅ Creado {p.Name} (SKU {p.Sku}) precio {p.Price} stock +{p.StockDelta}");
                }
                else
                {
                    var id = p.ExistingId!.Value;
                    // Price update if needed
                    if (p.Price != null && p.Price != p.CurrentPrice)
                    {
                        // Need existing description for Update: keep existing if not provided
                        var existingProd = await _db.Products.FirstOrDefaultAsync(x => x.Id == id, ct);
                        var desc = p.Description ?? existingProd?.Description;
                        // Use raw name if provided otherwise existing name
                        var nameForUpdate = !string.IsNullOrWhiteSpace(p.Name) ? p.Name : existingProd!.Name;
                        await _productService.UpdateAsync(id, new UpdateProductDto(nameForUpdate, p.Price.Value, desc));
                        sb.AppendLine($"- ✅ Precio actualizado {p.Name}: {p.CurrentPrice} → {p.Price}");
                    }
                    if (p.StockDelta.HasValue && p.StockDelta.Value != 0)
                    {
                        await _productService.AdjustStockAsync(id, new StockAdjustmentDto(p.StockDelta.Value, "Reposición vía asistente"));
                        sb.AppendLine($"- ✅ Stock repuesto {p.Name}: +{p.StockDelta} (antes {p.CurrentStock})");
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
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Error ejecutando propuesta {Product}", p.Name);
                sb.AppendLine($"- ❌ Error en {p.Name}: {ex.Message}");
            }
        }
        if (sb.Length == 0) return "No se ejecutó ninguna acción.";
        return sb.ToString().Trim();
    }

    private async Task<Category> EnsureCategoryAsync(string name, CancellationToken ct)
    {
        var norm = name.Trim();
        var existing = await _db.Categories
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(c => c.Name.ToLower() == norm.ToLower(), ct);
        if (existing != null)
        {
            if (!existing.IsActive) existing.Activate();
            return existing;
        }
        var cat = new Category(norm, null);
        _db.Categories.Add(cat);
        await _db.SaveChangesAsync(ct);
        return cat;
    }
}
