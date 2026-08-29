using FluentValidation;
using static MetraTC.Application.DTOs.ProductDtos;

namespace MetraTC.Application.Validators.Product;

public class BulkPriceAdjustmentDtoValidator : AbstractValidator<BulkPriceAdjustmentDto>
{
    public BulkPriceAdjustmentDtoValidator()
    {
        RuleFor(x => x.Reason)
            .NotEmpty().WithMessage("Motivo requerido")
            .MinimumLength(3).WithMessage("Motivo debe tener al menos 3 caracteres")
            .MaximumLength(500).WithMessage("Motivo no puede exceder 500 caracteres");

        RuleFor(x => x.Percentage)
            .InclusiveBetween(-90, 500).WithMessage("Percentage debe estar entre -90 y 500")
            .When(x => x.Percentage.HasValue);

        RuleFor(x => x.FixedAmount)
            .InclusiveBetween(-1_000_000, 1_000_000).WithMessage("FixedAmount debe estar entre -1000000 y 1000000")
            .When(x => x.FixedAmount.HasValue);

        RuleFor(x => x)
            .Must(x => (x.Percentage.HasValue && x.Percentage.Value != 0) || (x.FixedAmount.HasValue && x.FixedAmount.Value != 0))
            .WithMessage("Al menos uno de Percentage o FixedAmount debe ser distinto de 0");
    }
}
