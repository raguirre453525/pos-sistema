using FluentValidation;
using static MetraTC.Application.DTOs.AssistantDtos;

namespace MetraTC.Application.Validators.Assistant;

public class ChatRequestDtoValidator : AbstractValidator<ChatRequestDto>
{
    public ChatRequestDtoValidator()
    {
        RuleFor(x => x.Message)
            .NotEmpty().WithMessage("El mensaje es obligatorio")
            .MinimumLength(1).WithMessage("El mensaje no puede estar vacío")
            .MaximumLength(2000).WithMessage("El mensaje no puede exceder 2000 caracteres");

        RuleForEach(x => x.History)
            .ChildRules(h =>
            {
                h.RuleFor(m => m.Role)
                    .Must(r => r == "user" || r == "assistant")
                    .WithMessage("Role debe ser 'user' o 'assistant'");
                h.RuleFor(m => m.Content)
                    .NotEmpty().WithMessage("El contenido del historial no puede estar vacío")
                    .MaximumLength(2000).WithMessage("Cada mensaje del historial no puede exceder 2000 caracteres");
            });
    }
}
