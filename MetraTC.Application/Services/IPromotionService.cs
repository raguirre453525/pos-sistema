using static MetraTC.Application.DTOs.PromotionDtos;

namespace MetraTC.Application.Services;

public interface IPromotionService
{
    Task<PromotionDto> CreateAsync(CreatePromotionDto dto);
    Task<PromotionDto> UpdateAsync(Guid id, UpdatePromotionDto dto);
    Task DeleteAsync(Guid id);
    Task<IEnumerable<PromotionDto>> GetAllAsync();
    Task<IEnumerable<PromotionDto>> GetActiveAsync();
    Task<PromotionDto> GetByIdAsync(Guid id);
    Task<PromotionDto> ToggleActiveAsync(Guid id);
}
