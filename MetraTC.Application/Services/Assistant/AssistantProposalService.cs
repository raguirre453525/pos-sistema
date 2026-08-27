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
            // Search existence: first by Sku exact case-insensitive if Sku present, else by Name exact case-insensitive
            Product? existing = null;
            if (!string.IsNullOrWhiteSpace(raw.Sku))
            {
                var skuNorm = raw.Sku.Trim().ToLower();
                existing = await _db.Products
                    .Include(p => p.Categories)
                    .FirstOrDefaultAsync(p => p.Sku.ToLower() == skuNorm, ct);
            }
            if (existing == null && !string.IsNullOrWhiteSpace(raw.Name))
            {
                var nameNorm = raw.Name.Trim().ToLower();
                existing = await _db.Products
                    .Include(p => p.Categories)
                    .FirstOrDefaultAsync(p => p.Name.ToLower() == nameNorm, ct);
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
                // Exists: optional price change detection
                if (raw.Price != null && raw.Price != currentPrice)
                    action = "restock+price_update";
                else
                    action = "restock";
                // StockDelta may be null -> still restock with no delta? But spec says if no price only stock. If both missing? Still proposal with no delta?
                // We treat missing stock as not requiring, but will not execute stock adjust if null/0.
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
        sb.AppendLine("Entendí lo siguiente:");
        sb.AppendLine();
        sb.AppendLine("| Producto | Existe? | Acción | Stock | Precio | Categoría | Faltantes |");
        sb.AppendLine("|---|---|---|---|---|---|---|");
        foreach (var p in proposals)
        {
            var existe = p.Exists ? "Sí" : "No";
            var accion = p.Action;
            var stock = p.StockDelta != null ? $"+{p.StockDelta} (actual: {p.CurrentStock?.ToString() ?? "-"})" : (p.Exists ? $"actual: {p.CurrentStock}" : "-");
            var precio = p.Price != null
                ? (p.Exists ? $"{p.CurrentPrice} → {p.Price}" : $"{p.Price}")
                : (p.CurrentPrice?.ToString() ?? "-");
            var cat = p.CategoryNames != null && p.CategoryNames.Count > 0 ? string.Join(", ", p.CategoryNames) : "-";
            var falt = p.MissingFields.Count > 0 ? string.Join(", ", p.MissingFields) : "-";
            // Escape pipes in name
            var nameEsc = p.Name.Replace("|", "/");
            sb.AppendLine($"| {nameEsc} | {existe} | {accion} | {stock} | {precio} | {cat} | {falt} |");
        }
        sb.AppendLine();
        var hasMissing = proposals.Any(p => p.MissingFields.Count > 0);
        if (hasMissing)
        {
            sb.AppendLine("⚠️ Faltan datos obligatorios para crear: `Sku`, `Name`, `Price`, `Stock` inicial. Decime los que faltan y vuelvo a proponer.");
        }
        else
        {
            sb.AppendLine("¿Te parece bien? Decime **\"sí, dale\"** para confirmar o decime qué corregir (ej: \"no, la coca es 1500 no 1600\" o \"el sku está mal\").");
        }
        return sb.ToString();
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
