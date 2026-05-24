using FluentValidation;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Validators.Product;

public class StockAdjustmentDtoValidator : AbstractValidator<StockAdjustmentDto>
{
    public StockAdjustmentDtoValidator()
    {
        RuleFor(x => x.Delta)
            .NotEqual(0).WithMessage("El ajuste de stock no puede ser cero");

        RuleFor(x => x.Reason)
            .Must(reason => !string.IsNullOrWhiteSpace(reason))
            .WithMessage("El motivo del ajuste es obligatorio")
            .MaximumLength(250).WithMessage("El motivo no puede exceder los 250 caracteres");
    }
}
