using MetraTC.Domain.Common;
using System;
using System.Collections.Generic;
using System.Text;

namespace MetraTC.Domain.Entities;

public class Product : BaseEntity
{
    public string Sku { get; init; }
    public string? Barcode { get; private set; }
    public string Name { get; private set; }
    public string? Description { get; private set; }
    public decimal Price { get; private set; }
    public decimal Stock { get; private set; }
    public string? ImageUrl { get; private set; }
    public string? Unit { get; private set; }
    public decimal? MinStock { get; private set; }

    /// <summary>
    /// Modo de venta simplificado: "un" (por unidad) vs "kg" (a granel por peso).
    /// Decisión: no se introduce columna SaleMode para minimizar migración; se normaliza Unit
    /// a valores canónicos "un"/"kg". IsSoldByWeight computada. Bulto/caja diferido.
    /// </summary>
    public bool IsSoldByWeight => string.Equals(NormalizeUnit(Unit), "kg", StringComparison.OrdinalIgnoreCase);

    public ICollection<Category> Categories { get; private set; } = new List<Category>();

    public Product(string sku, string name, decimal price, string? barcode = null, string? description = null, string? imageUrl = null, string? unit = null, decimal? minStock = null)
    {
        ValidateDataAndSku(sku, name, price);

        Sku = sku;
        Barcode = barcode;
        Name = name;
        Description = description;
        Price = price;
        Stock = 0;
        SetImageUrl(imageUrl);
        SetUnit(unit);
        SetMinStock(minStock);
    }

    public void Update(string newName, decimal newPrice, string? newDescription)
    {
        ValidateData(newName, newPrice);

        Name = newName;
        Price = newPrice;
        Description = string.IsNullOrWhiteSpace(newDescription) ? null : newDescription;
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

    public static string? NormalizeUnit(string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit)) return null;
        var t = unit.Trim().ToLowerInvariant();
        if (t == "granel") return "kg";
        if (t == "kg" || t == "un") return t;
        // legacy values (lt, pack, caja, etc.) se normalizan a "un" para compatibilidad hacia atrás
        // pero la validación rechaza valores nuevos fuera de un/kg; este mapeo solo es para lectura
        return t;
    }

    public void SetUnit(string? unit)
    {
        if (string.IsNullOrWhiteSpace(unit))
        {
            Unit = null;
            return;
        }
        var trimmed = unit.Trim().ToLowerInvariant();
        // Solo se permiten valores canónicos "un" y "kg" (granel se mapea a kg)
        if (trimmed == "granel") trimmed = "kg";
        if (trimmed != "un" && trimmed != "kg")
            throw new ArgumentException("La unidad debe ser 'un' o 'kg'", nameof(unit));
        Unit = trimmed;
    }

    public void SetMinStock(decimal? min)
    {
        if (min == null)
        {
            MinStock = null;
            return;
        }
        if (min < 0 || min > 99999)
            throw new ArgumentException("El stock mínimo debe estar entre 0 y 99999", nameof(min));
        MinStock = min;
    }

    public bool IsLowStock()
    {
        if (MinStock.HasValue) return Stock <= MinStock.Value;
        return Stock <= 5;
    }

    public decimal AdjustStock(decimal delta)
    {
        if (delta == 0)
            throw new ArgumentException("El ajuste de stock no puede ser cero", nameof(delta));

        var resultingStock = Stock + delta;
        if (resultingStock < 0)
            throw new ArgumentException("El stock resultante no puede ser negativo", nameof(delta));
        if (resultingStock > 999999999)
            throw new ArgumentException("El stock resultante excede el límite permitido", nameof(delta));
        // Redondeo a 3 decimales para kg
        resultingStock = Math.Round(resultingStock, 3, MidpointRounding.AwayFromZero);
        delta = Math.Round(delta, 3, MidpointRounding.AwayFromZero);

        Stock = resultingStock;
        return Stock;
    }

    private void ValidateDataAndSku(string sku, string name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(sku))
            throw new ArgumentException("El SKU es obligatorio", nameof(sku));

        ValidateData(name, price);
    }

    private void ValidateData(string name, decimal price)
    {
        if (string.IsNullOrWhiteSpace(name))
            throw new ArgumentException("El nombre del producto es obligatorio", nameof(name));
        if (name.Length > 50)
            throw new ArgumentException("El nombre del producto no puede exceder los 50 caracteres");

        if (decimal.IsNegative(price))
            throw new ArgumentException("El precio del producto no puede ser negativo", nameof(price));
    }
}
