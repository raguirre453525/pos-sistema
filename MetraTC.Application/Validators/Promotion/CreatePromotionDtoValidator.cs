using FluentValidation;
using static MetraTC.Application.DTOs.PromotionDtos;
using MetraTC.Domain.Entities;

namespace MetraTC.Application.Validators.Promotion;

public class CreatePromotionDtoValidator : AbstractValidator<CreatePromotionDto>
{
    public CreatePromotionDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(3, 80);
        RuleFor(x => x.Description).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.Description));
        RuleFor(x => x.ComboPrice).GreaterThan(0).When(x => x.Type == PromotionType.Combo).WithMessage("ComboPrice debe ser > 0");
        RuleFor(x => x.DiscountPercentage).InclusiveBetween(1, 90).When(x => x.Type == PromotionType.Percentage);
        RuleFor(x => x.ValidTo).GreaterThanOrEqualTo(x => x.ValidFrom).When(x => x.ValidFrom.HasValue && x.ValidTo.HasValue);
        RuleFor(x => x.ImageUrl).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.ImageUrl));
        RuleFor(x => x).Custom((dto, ctx) =>
        {
            var hasLines = dto.Lines != null && dto.Lines.Count > 0;
            var hasLegacy = dto.ProductIds != null && dto.ProductIds.Count > 0;
            if (!hasLines && !hasLegacy) ctx.AddFailure("Lines", "Debe incluir productos con cantidad");
            var effective = hasLines ? dto.Lines! : (dto.ProductIds ?? new List<Guid>()).Select(id => new PromotionLineDto(id, 1)).ToList();
            if (dto.Type == PromotionType.Combo)
            {
                var totalUnits = effective.Sum(e => e.Quantity);
                if (totalUnits < 2) ctx.AddFailure("Lines", "Combo requiere al menos 2 unidades (suma cantidades >=2) — permite 3x2 con qty 3");
            }
            if (effective.Any(e => e.Quantity < 1 || e.Quantity > 99)) ctx.AddFailure("Lines", "Quantity debe estar entre 1 y 99");
        });
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(e => e.ProductId).NotEmpty();
            l.RuleFor(e => e.Quantity).InclusiveBetween(1, 99);
        });
    }
}
public class UpdatePromotionDtoValidator : AbstractValidator<UpdatePromotionDto>
{
    public UpdatePromotionDtoValidator()
    {
        RuleFor(x => x.Name).NotEmpty().Length(3, 80);
        RuleFor(x => x.Description).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.Description));
        RuleFor(x => x.ComboPrice).GreaterThan(0).When(x => x.Type == PromotionType.Combo);
        RuleFor(x => x.DiscountPercentage).InclusiveBetween(1, 90).When(x => x.Type == PromotionType.Percentage);
        RuleFor(x => x.ValidTo).GreaterThanOrEqualTo(x => x.ValidFrom).When(x => x.ValidFrom.HasValue && x.ValidTo.HasValue);
        RuleFor(x => x.ImageUrl).MaximumLength(500).When(x => !string.IsNullOrWhiteSpace(x.ImageUrl));
        RuleFor(x => x).Custom((dto, ctx) =>
        {
            var hasLines = dto.Lines != null && dto.Lines.Count > 0;
            var hasLegacy = dto.ProductIds != null && dto.ProductIds.Count > 0;
            if (!hasLines && !hasLegacy) ctx.AddFailure("Lines", "Debe incluir productos");
            var effective = hasLines ? dto.Lines! : (dto.ProductIds ?? new List<Guid>()).Select(id => new PromotionLineDto(id, 1)).ToList();
            if (dto.Type == PromotionType.Combo)
            {
                var totalUnits = effective.Sum(e => e.Quantity);
                if (totalUnits < 2) ctx.AddFailure("Lines", "Combo requiere al menos 2 unidades");
            }
        });
        RuleForEach(x => x.Lines).ChildRules(l =>
        {
            l.RuleFor(e => e.ProductId).NotEmpty();
            l.RuleFor(e => e.Quantity).InclusiveBetween(1, 99);
        });
    }
}
