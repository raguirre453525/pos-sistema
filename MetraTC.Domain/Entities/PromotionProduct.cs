using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

/// <summary>
/// Join explícita Promotion-Product con cantidad. Permite 3x2 mismo producto via Quantity>1. Decisión: Promotion navega Lines, TotalUnits = sum(Quantity) >=2.
/// </summary>
public class PromotionProduct : BaseEntity
{
    public Guid PromotionId { get; private set; }
    public Promotion Promotion { get; private set; } = null!;
    public Guid ProductId { get; private set; }
    public Product Product { get; private set; } = null!;
    public int Quantity { get; private set; }

    private PromotionProduct() : base() { }

    public PromotionProduct(Guid promotionId, Guid productId, int quantity)
    {
        if (promotionId == Guid.Empty) throw new ArgumentException("PromotionId requerido", nameof(promotionId));
        if (productId == Guid.Empty) throw new ArgumentException("ProductId requerido", nameof(productId));
        if (quantity < 1 || quantity > 99) throw new ArgumentException("Quantity 1..99", nameof(quantity));
        PromotionId = promotionId;
        ProductId = productId;
        Quantity = quantity;
    }

    internal void SetPromotion(Promotion promotion)
    {
        Promotion = promotion ?? throw new ArgumentNullException(nameof(promotion));
        PromotionId = promotion.Id;
    }
}
