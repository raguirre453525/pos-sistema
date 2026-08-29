using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public class StockAdjustmentAudit : BaseEntity
{
    public Guid ProductId { get; private set; }
    public decimal Delta { get; private set; }
    public decimal ResultingStock { get; private set; }
    public string Reason { get; private set; }
    public DateTime AdjustedAt { get; private set; }

    public Product Product { get; private set; } = null!;

    private StockAdjustmentAudit()
    {
        Reason = string.Empty;
    }

    public StockAdjustmentAudit(Product product, decimal delta, decimal resultingStock, string reason)
    {
        if (product is null)
            throw new ArgumentNullException(nameof(product));
        if (delta == 0)
            throw new ArgumentException("El ajuste de stock no puede ser cero", nameof(delta));
        if (resultingStock < 0)
            throw new ArgumentException("El stock resultante no puede ser negativo", nameof(resultingStock));
        if (string.IsNullOrWhiteSpace(reason) || reason.Length > 250)
            throw new ArgumentException("El motivo debe tener entre 1 y 250 caracteres", nameof(reason));

        Product = product;
        ProductId = product.Id;
        Delta = delta;
        ResultingStock = resultingStock;
        Reason = reason.Trim();
        AdjustedAt = DateTime.UtcNow;
    }
}
