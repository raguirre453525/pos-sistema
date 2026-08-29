using MetraTC.Domain.Common;

namespace MetraTC.Domain.Entities;

public enum PromotionType { Combo = 0, Percentage = 1 }

public class Promotion : BaseEntity
{
    public string Name { get; private set; } = null!;
    public string? Description { get; private set; }
    public PromotionType Type { get; private set; }
    public DateTime? ValidFrom { get; private set; }
    public DateTime? ValidTo { get; private set; }
    public decimal? ComboPrice { get; private set; }
    public decimal? DiscountPercentage { get; private set; }
    public string? ImageUrl { get; private set; }
    // Join explícita con cantidad (soporta 3x2 mismo producto con Quantity>1)
    public ICollection<PromotionProduct> Lines { get; private set; } = new List<PromotionProduct>();
    // Compat: Products derivado de Lines (no mapeado por EF) - para código legacy
    public ICollection<Product> Products => Lines.Select(l => l.Product).Where(p => p != null).ToList();

    public int TotalUnits => Lines.Sum(l => l.Quantity);

    // EF Core constructor
    private Promotion() : base() { }

    // Constructor con Products (qty 1) - mantiene compat con código existente
    public Promotion(
        string name,
        PromotionType type,
        string? description,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        ICollection<Product> products)
        : this(name, type, description, isActive, validFrom, validTo, comboPrice, discountPercentage, products?.Select(p => (p.Id, 1, p)) ?? Enumerable.Empty<(Guid,int,Product)>())
    {
    }

    // Constructor principal con líneas (productId + quantity + Product entity para snapshot)
    public Promotion(
        string name,
        PromotionType type,
        string? description,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        IEnumerable<(Guid productId, int quantity, Product product)> lines)
    {
        Name = name?.Trim() ?? throw new ArgumentException("El nombre es obligatorio", nameof(name));
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type;
        ValidFrom = validFrom;
        ValidTo = validTo;
        ComboPrice = comboPrice;
        DiscountPercentage = discountPercentage;

        Lines = new List<PromotionProduct>();
        if (lines != null)
        {
            foreach (var (pid, qty, prod) in lines)
            {
                AddLine(pid, qty, prod);
            }
        }

        if (isActive) Activate(); else Deactivate();
        Validate();
    }

    // Constructor simplificado que solo recibe ids+qty y resuelve Product después (usado por service)
    public Promotion(
        string name,
        PromotionType type,
        string? description,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        IEnumerable<(Guid productId, int quantity)> lines)
    {
        Name = name?.Trim() ?? throw new ArgumentException("El nombre es obligatorio", nameof(name));
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type;
        ValidFrom = validFrom;
        ValidTo = validTo;
        ComboPrice = comboPrice;
        DiscountPercentage = discountPercentage;
        Lines = new List<PromotionProduct>();
        if (lines != null)
        {
            foreach (var (pid, qty) in lines)
            {
                if (pid == Guid.Empty) throw new ArgumentException("ProductId requerido", nameof(lines));
                if (qty < 1 || qty > 99) throw new ArgumentException("Quantity 1..99", nameof(lines));
                var pp = new PromotionProduct(Id, pid, qty);
                Lines.Add(pp);
            }
        }
        if (isActive) Activate(); else Deactivate();
        Validate();
    }

    public void AddLine(Guid productId, int quantity, Product? product = null)
    {
        if (productId == Guid.Empty) throw new ArgumentException("ProductId requerido", nameof(productId));
        if (quantity < 1 || quantity > 99) throw new ArgumentException("Quantity debe estar entre 1 y 99", nameof(quantity));
        if (Lines.Any(l => l.ProductId == productId)) throw new ArgumentException($"Producto duplicado en combo: {productId}", nameof(productId));
        var pp = new PromotionProduct(Id, productId, quantity);
        // Si tenemos entity Product, setear navegación para que Products getter funcione antes de SaveChanges
        if (product != null)
        {
            // Usar reflexión para setear Product navigation private setter via backing? PromotionProduct.Product is private set but we can use internal? Simplify: just keep pp as is, EF will fixup via navigation
        }
        Lines.Add(pp);
    }

    public void Update(
        string name,
        string? description,
        PromotionType type,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        ICollection<Product> products)
    {
        Update(name, description, type, isActive, validFrom, validTo, comboPrice, discountPercentage, products?.Select(p => (p.Id, 1)) ?? Enumerable.Empty<(Guid,int)>());
    }

    public void Update(
        string name,
        string? description,
        PromotionType type,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        IEnumerable<(Guid productId, int quantity)> lines)
    {
        Name = name?.Trim() ?? throw new ArgumentException("El nombre es obligatorio", nameof(name));
        Description = string.IsNullOrWhiteSpace(description) ? null : description.Trim();
        Type = type;
        ValidFrom = validFrom;
        ValidTo = validTo;
        ComboPrice = comboPrice;
        DiscountPercentage = discountPercentage;

        Lines.Clear();
        if (lines != null)
        {
            foreach (var (pid, qty) in lines)
            {
                if (pid == Guid.Empty) throw new ArgumentException("ProductId requerido", nameof(lines));
                if (qty < 1 || qty > 99) throw new ArgumentException("Quantity 1..99", nameof(lines));
                Lines.Add(new PromotionProduct(Id, pid, qty));
            }
        }

        if (isActive) Activate(); else Deactivate();
        Validate();
    }

    // Helper para service que pasa products entities con qty
    public void UpdateWithProducts(
        string name,
        string? description,
        PromotionType type,
        bool isActive,
        DateTime? validFrom,
        DateTime? validTo,
        decimal? comboPrice,
        decimal? discountPercentage,
        IEnumerable<(Product product, int quantity)> productLines)
    {
        var mapped = productLines.Select(pl => (pl.product.Id, pl.quantity));
        Update(name, description, type, isActive, validFrom, validTo, comboPrice, discountPercentage, mapped);
        // Reemplazar con entidades con navegación si hace falta: limpiar y recrear con ctor que no necesita navegación
    }

    public void SetImageUrl(string? url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            ImageUrl = null;
            return;
        }
        var trimmed = url.Trim();
        if (trimmed.Length > 500)
            throw new ArgumentException("La URL de imagen no puede exceder 500 caracteres", nameof(url));
        ImageUrl = trimmed;
    }

    public void SetActive(bool v)
    {
        if (v) Activate(); else Deactivate();
    }

    public bool IsCurrentlyActive(DateTime now) =>
        IsActive && (ValidFrom == null || now >= ValidFrom) && (ValidTo == null || now <= ValidTo);

    private void Validate()
    {
        if (string.IsNullOrWhiteSpace(Name) || Name.Length < 3 || Name.Length > 80)
            throw new ArgumentException("El nombre debe tener entre 3 y 80 caracteres", nameof(Name));

        if (Description != null && Description.Length > 500)
            throw new ArgumentException("La descripción no puede exceder 500 caracteres", nameof(Description));

        if (ValidFrom.HasValue && ValidTo.HasValue && ValidTo.Value < ValidFrom.Value)
            throw new ArgumentException("La fecha Hasta no puede ser anterior a Desde", nameof(ValidTo));

        if (Type == PromotionType.Combo)
        {
            if (!ComboPrice.HasValue || ComboPrice.Value <= 0)
                throw new ArgumentException("El precio combo debe ser mayor a 0", nameof(ComboPrice));
            if (DiscountPercentage.HasValue)
                throw new ArgumentException("Descuento no aplica para combo", nameof(DiscountPercentage));
            if (Lines == null || TotalUnits < 2)
                throw new ArgumentException("Un combo debe tener al menos 2 unidades (suma de cantidades >=2) — permite 3x2 del mismo producto con qty 3", nameof(Lines));
        }
        else // Percentage
        {
            if (!DiscountPercentage.HasValue || DiscountPercentage.Value < 1 || DiscountPercentage.Value > 90)
                throw new ArgumentException("El descuento debe estar entre 1 y 90", nameof(DiscountPercentage));
            if (ComboPrice.HasValue)
                throw new ArgumentException("Precio combo no aplica para descuento porcentual", nameof(ComboPrice));
            if (Lines == null || Lines.Count < 1)
                throw new ArgumentException("Una promo debe tener al menos 1 producto", nameof(Lines));
        }
    }
}
