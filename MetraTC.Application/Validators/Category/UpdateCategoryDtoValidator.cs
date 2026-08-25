using FluentValidation;
using static MetraTC.Application.DTOs.CategoryDtos;

namespace MetraTC.Application.Validators.Category;

public class UpdateCategoryDtoValidator : AbstractValidator<UpdateCategoryDto>
{
    public UpdateCategoryDtoValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("El nombre es requerido")
            .MaximumLength(100).WithMessage("El nombre no puede exceder los 100 caracteres");

        RuleFor(x => x.Description)
            .MaximumLength(500).WithMessage("La descripción no puede exceder los 500 caracteres")
            .When(x => !string.IsNullOrWhiteSpace(x.Description));
    }
}
