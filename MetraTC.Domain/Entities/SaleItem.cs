using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public class SaleItem : BaseEntity
{
    public Guid SaleId { get; private set; }
    public Sale Sale { get; private set; } = null!;
    public Guid ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public int Quantity { get; private set; }
    public decimal UnitPrice { get; private set; }
    public decimal Subtotal { get; private set; }
    // Trazabilidad combo: nullable para historial. Ver ADR: SalePromotion + SaleItem.PromotionId permite ver "qué combos se vendieron" y descontar stock por componente.
    public Guid? PromotionId { get; private set; }
    public string? PromotionName { get; private set; }
    public bool IsFromCombo => PromotionId.HasValue;

    private SaleItem()
    {
    }

    public SaleItem(Guid productId, int quantity, decimal unitPrice, Guid? promotionId = null, string? promotionName = null)
    {
        if (productId == Guid.Empty)
            throw new ArgumentException("El ProductId es obligatorio", nameof(productId));
        if (quantity <= 0)
            throw new ArgumentException("La cantidad debe ser mayor a cero", nameof(quantity));
        if (unitPrice < 0)
            throw new ArgumentException("El precio unitario no puede ser negativo", nameof(unitPrice));

        ProductId = productId;
        Quantity = quantity;
        UnitPrice = unitPrice;
        Subtotal = quantity * unitPrice;
        PromotionId = promotionId;
        PromotionName = string.IsNullOrWhiteSpace(promotionName) ? null : promotionName.Trim();
    }

    internal void SetSale(Sale sale)
    {
        Sale = sale ?? throw new ArgumentNullException(nameof(sale));
        SaleId = sale.Id;
    }
}
