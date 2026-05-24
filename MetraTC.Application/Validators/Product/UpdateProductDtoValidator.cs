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
    }
}
