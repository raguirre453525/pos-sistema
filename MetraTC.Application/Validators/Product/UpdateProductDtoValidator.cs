using FluentValidation;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Validators.Product;

public class UpdateProductDtoValidator : AbstractValidator<UpdateProductDto>
{
    public UpdateProductDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("El nombre del producto es obligatorio")
            .MaximumLength(50).WithMessage("El nombre del producto no puede exceder los 50 caracteres");

        RuleFor(x => x.Price)
            .GreaterThanOrEqualTo(0).WithMessage("El precio del producto no puede ser negativo");

        RuleFor(x => x.ImageUrl)
            .MaximumLength(500).WithMessage("La URL de imagen no puede exceder 500 caracteres")
            .When(x => !string.IsNullOrWhiteSpace(x.ImageUrl));

        RuleFor(x => x.Unit)
            .MinimumLength(1).WithMessage("La unidad debe tener al menos 1 carácter")
            .MaximumLength(20).WithMessage("La unidad no puede exceder 20 caracteres")
            .When(x => !string.IsNullOrWhiteSpace(x.Unit));

        RuleFor(x => x.MinStock)
            .InclusiveBetween(0, 99999).WithMessage("El stock mínimo debe estar entre 0 y 99999")
            .When(x => x.MinStock.HasValue);
    }
}
