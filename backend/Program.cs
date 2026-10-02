using FluentValidation;
using MetraTC.Application.Services;
using MetraTC.Application.Services.Assistant;
using MetraTC.Application.Validators.Product;
using MetraTC.Domain.Interfaces;
using MetraTC.Infrastructure.Persistence;
using MetraTC.Infrastructure.Repositories;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi;
using SharpGrip.FluentValidation.AutoValidation.Mvc.Extensions;
using System.Text;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddControllers(options => options.AllowEmptyInputInBodyModelBinding = true);

builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        policy.WithOrigins("http://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

builder.Services.AddFluentValidationAutoValidation();
builder.Services.AddValidatorsFromAssemblyContaining<CreateProductDtoValidator>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(c =>
{
    c.SwaggerDoc("v1", new OpenApiInfo { Title = "MetraTC API", Version = "v1" });
    c.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });
});

// JWT Bearer configuration
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"] ?? "METRATC_SUPER_SECRET_KEY_REPLACE_IN_PROD_32_CHARS_MIN_64_XYZ!";
var jwtIssuer = jwtSection["Issuer"] ?? "MetraTC";
var jwtAudience = jwtSection["Audience"] ?? "MetraTC";

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.RequireHttpsMetadata = false;
    options.SaveToken = true;
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidateAudience = true,
        ValidateLifetime = true,
        ValidateIssuerSigningKey = true,
        ValidIssuer = jwtIssuer,
        ValidAudience = jwtAudience,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey)),
        ClockSkew = TimeSpan.Zero
    };
});

builder.Services.AddAuthorization();

builder.Services.AddDbContext<ApplicationDbContext>(options =>
{
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection"));
});

builder.Services.AddAutoMapper(cfg =>
{
    cfg.AddMaps(typeof(MetraTC.Application.Mappings.ProductProfile).Assembly);
});

builder.Services.AddScoped(typeof(IRepository<>), typeof(BaseRepository<>));
builder.Services.AddScoped<IInventoryRepository, InventoryRepository>();
builder.Services.AddScoped<ISalesRepository, SalesRepository>();
builder.Services.AddScoped<IProductService, ProductService>();
builder.Services.AddScoped<IProductPriceHistoryService, ProductPriceHistoryService>();
builder.Services.AddScoped<ICategoryService, CategoryService>();
builder.Services.AddScoped<ISalesService, SalesService>();
builder.Services.AddScoped<ICustomerService, CustomerService>();
builder.Services.AddScoped<IReportsService, ReportsService>();
builder.Services.AddScoped<IPromotionService, PromotionService>();

// Assistant - hybrid provider (mock | openai | deepseek | openrouter)
builder.Services.AddMemoryCache();
builder.Services.AddScoped<AssistantInventoryContext>();
builder.Services.AddScoped<MockAssistantProvider>();
builder.Services.AddHttpClient<OpenAiAssistantProvider>();
builder.Services.AddScoped<DeepSeekAssistantProvider>();
builder.Services.AddHttpClient<DeepSeekAssistantProvider>();
builder.Services.AddHttpClient<OpenRouterAssistantProvider>();
builder.Services.AddHttpClient<AssistantProductExtractor>();
builder.Services.AddScoped<AssistantProposalService>();
builder.Services.AddScoped<IAssistantService, AssistantService>();

var app = builder.Build();

app.UseMiddleware<MetraTC.Middlewares.ExceptionMiddleware>();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.UseCors("Frontend");

app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

app.Run();
