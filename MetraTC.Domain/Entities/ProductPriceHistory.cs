using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public class ProductPriceHistory : BaseEntity
{
    public Guid ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public decimal OldPrice { get; private set; }
    public decimal NewPrice { get; private set; }
    public DateTime ChangedAt { get; private set; }
    public string? Reason { get; private set; }

    private ProductPriceHistory()
    {
        Reason = null;
    }

    public ProductPriceHistory(Guid productId, decimal oldPrice, decimal newPrice, string? reason = null)
    {
        if (productId == Guid.Empty)
            throw new ArgumentException("ProductId es obligatorio", nameof(productId));
        if (oldPrice < 0)
            throw new ArgumentException("OldPrice no puede ser negativo", nameof(oldPrice));
        if (newPrice < 0)
            throw new ArgumentException("NewPrice no puede ser negativo", nameof(newPrice));

        ProductId = productId;
        OldPrice = oldPrice;
        NewPrice = newPrice;
        ChangedAt = DateTime.UtcNow;
        Reason = string.IsNullOrWhiteSpace(reason) ? null : reason.Trim();
    }

    public ProductPriceHistory(Product product, decimal oldPrice, decimal newPrice, string? reason = null)
        : this(product?.Id ?? throw new ArgumentNullException(nameof(product)), oldPrice, newPrice, reason)
    {
        Product = product;
    }
}
