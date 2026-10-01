using System.Globalization;
using System.Net;
using System.Reflection;
using System.Security.Claims;
using System.Text;
using System.Text.Json;
using MetraTC.API.Controllers;
using MetraTC.Application.Services.Assistant;
using MetraTC.Domain.Entities;
using static MetraTC.Application.DTOs.AssistantDtos;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;

const string imageDataUrl = "data:image/jpeg;base64,/9j/";

CultureInfo.CurrentCulture = CultureInfo.GetCultureInfo("es-AR");
Assert(AssistantInventoryContext.FormatStock(12m) == "12", "Whole-unit stock should not include a locale-specific decimal separator.");
Assert(AssistantInventoryContext.FormatStock(1.25m) == "1.25", "Fractional stock should use an invariant decimal separator.");
Assert(AssistantInventoryContext.FormatStockChange(12m) == "+12", "Stock increases should use an unambiguous invariant amount.");
Assert(AssistantInventoryContext.FormatStockChange(1.25m) == "+1.25", "Fractional stock increases should use a decimal point.");
Assert(AssistantInventoryContext.FormatStockChange(-2m) == "-2", "Stock decreases should not gain an extra plus sign.");
Assert(AssistantInventoryContext.FormatStockChange(0m) == "sin delta", "Zero stock changes should be treated as no-ops.");

const string stockConsultation = "Solo consulta: ¿cuántas unidades hay del producto TEST Chatbot - Filtro de aceite 1.6, SKU 99100001? Respondé con la cantidad sin ceros decimales innecesarios y sin modificar el inventario.";
Assert(AssistantProductExtractor.IsReadOnlyRequest(stockConsultation), "An explicit stock consultation should bypass proposal flows.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent(stockConsultation), "A stock consultation must not be treated as a write instruction.");
Assert(AssistantProductExtractor.IsReadOnlyRequest("¿Cuántas unidades hay del producto TEST Chatbot, SKU 99100001?"), "A stock question should bypass proposal flows without an explicit no-write phrase.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("¿Cuántas unidades hay del producto TEST Chatbot, SKU 99100001?"), "A stock question must not become a proposal because it includes a SKU.");
Assert(!AssistantProductExtractor.HasInventoryWriteIntent("¿Hay 5 unidades del producto TEST Chatbot, SKU 99100001?"), "A question that mentions a quantity must not be treated as a restock.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Reponé 5 unidades del producto TEST Chatbot, SKU 99100001."), "An explicit restock command should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("TEST Chatbot, 5 unidades."), "An unambiguous quantity statement should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Me llegaron 5 filtros de aceite."), "A received-stock instruction should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Actualizá el precio del filtro de aceite a 1500."), "An explicit price-update command should remain eligible for a proposal.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Reponé 5 unidades sin modificar el precio."), "A stock adjustment should remain eligible when the user excludes a price change.");
Assert(AssistantProductExtractor.HasInventoryWriteIntent("Descontar 3 unidades del producto TEST Chatbot."), "An explicit stock decrease should remain eligible for a proposal.");
Assert(DeepSeekAssistantProvider.SystemPrompt.Contains("separadores de miles", StringComparison.Ordinal), "DeepSeek should preserve unambiguous inventory quantity formatting.");
Assert(OpenAiAssistantProvider.SystemPrompt.Contains("separadores de miles", StringComparison.Ordinal), "OpenAI should preserve unambiguous inventory quantity formatting.");

using var mockHttpClient = new HttpClient();
using var loggerFactory = LoggerFactory.Create(_ => { });
var mockConfiguration = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?> { ["Assistant:Provider"] = "mock" })
    .Build();
var mockExtractor = new AssistantProductExtractor(mockConfiguration, mockHttpClient, loggerFactory.CreateLogger<AssistantProductExtractor>());
var extractedDecrease = await mockExtractor.ExtractAsync("Descontar 3 del producto TEST Chatbot", Array.Empty<ChatMessage>(), string.Empty, CancellationToken.None);
Assert(extractedDecrease.Count == 1 && extractedDecrease[0].StockDelta == -3m, "The mock extractor should preserve a subtractive command as a negative delta.");
var extractedRestock = await mockExtractor.ExtractAsync("Reponer 5 unidades del producto TEST Chatbot", Array.Empty<ChatMessage>(), string.Empty, CancellationToken.None);
Assert(extractedRestock.Count == 1 && extractedRestock[0].StockDelta == 5m, "The mock extractor should preserve positive restocks.");

var inconsistentExtraction = new List<RawProductExtract> { new("TEST Chatbot", null, null, 3m, null, null, null) };
Assert(AssistantProductExtractor.TryNormalizeStockDirections("Descontar 3 unidades del producto TEST Chatbot", inconsistentExtraction, out var correctedExtraction), "A single clear subtractive command should have a trusted direction.");
Assert(correctedExtraction[0].StockDelta == -3m, "The trusted boundary should correct an unsigned positive LLM delta for a subtractive command.");
Assert(!AssistantProductExtractor.TryNormalizeStockDirections("Reponé 5 unidades del producto A y descontar 2 unidades del producto B", inconsistentExtraction, out _), "Mixed increase and decrease requests must fail safe instead of sharing one sign.");
Assert(AssistantProductExtractor.HasStockMovementIntent("Sí, dale, descontar 3 unidades del producto TEST Chatbot"), "A stock command appended to confirmation text must not be treated as a bare confirmation.");
var inconsistentCreate = new List<RawProductExtract> { new("TEST New Product", null, null, -4m, null, null, null) };
Assert(AssistantProductExtractor.TryNormalizeStockDirections("Crear producto TEST New Product con 4 unidades", inconsistentCreate, out var correctedCreate), "A create request should have a trusted positive initial-stock direction.");
Assert(correctedCreate[0].StockDelta == 4m, "The trusted boundary should preserve positive initial stock for create flows.");

var stockGuardProduct = new Product("CHECK-STOCK", "Stock Guard Check", 1m);
stockGuardProduct.AdjustStock(2m);
var rejectedNegativeStock = false;
try
{
    stockGuardProduct.AdjustStock(-3m);
}
catch (ArgumentException)
{
    rejectedNegativeStock = true;
}
Assert(rejectedNegativeStock && stockGuardProduct.Stock == 2m, "The existing product stock invariant should reject a decrease below zero without changing stock.");

Assert(!AssistantProposalService.HasActionableExistingChanges(12m, null, null, false), "An existing product with no requested changes should not produce a proposal.");
Assert(!AssistantProposalService.HasActionableExistingChanges(12m, 12m, 0m, false), "A zero stock delta and unchanged price should not produce a proposal.");
Assert(AssistantProposalService.HasActionableExistingChanges(12m, null, 5m, false), "A nonzero stock adjustment should remain actionable.");
Assert(AssistantProposalService.HasActionableExistingChanges(12m, 13m, null, false), "A real price update should remain actionable without a stock delta.");
Assert(AssistantProposalService.HasActionableExistingChanges(12m, null, 0m, true), "A category change should remain actionable without a stock delta.");

var stockProposal = new ProposalResponse(
    [new ProductProposal("CHECK-STOCK", null, null, 2m, null, null, null, true, Guid.NewGuid(), 0m, 1m, [], "restock")],
    "Confirm stock adjustment",
    true,
    false);
var priceProposal = new ProposalResponse(
    [new ProductProposal("CHECK-STOCK", null, 20m, null, null, null, null, true, Guid.NewGuid(), 10m, 1m, [], "price_update")],
    "Confirm price update",
    true,
    false);
Assert(AssistantService.CanExecuteProposal(priceProposal, false), "Stock permission must not block non-stock assistant proposals.");

var employeeAssistant = new CaptureAssistantService();
var employeeController = CreateAssistantController(employeeAssistant, "User");
var employeeChatResult = await employeeController.Chat(new ChatRequestDto(stockConsultation, null), CancellationToken.None);
Assert(employeeChatResult is OkObjectResult && employeeAssistant.LastMessage == stockConsultation, "Employees must retain read-only assistant chat access.");
Assert(employeeAssistant.CanConfirmStockAdjustments == false, "An employee principal must not authorize assistant stock confirmation.");
Assert(!AssistantService.CanExecuteProposal(stockProposal, employeeAssistant.CanConfirmStockAdjustments == true), "Employees must not execute assistant stock adjustments.");

var adminAssistant = new CaptureAssistantService();
var adminController = CreateAssistantController(adminAssistant, "Admin");
var adminChatResult = await adminController.Chat(new ChatRequestDto("Sí, confirmo", null), CancellationToken.None);
Assert(adminChatResult is OkObjectResult && adminAssistant.CanConfirmStockAdjustments == true, "An administrator principal must authorize assistant stock confirmation.");
Assert(AssistantService.CanExecuteProposal(stockProposal, adminAssistant.CanConfirmStockAdjustments == true), "Administrators must be able to confirm assistant stock adjustments.");

var stockAdjustmentAuthorization = typeof(ProductsController)
    .GetMethod(nameof(ProductsController.AdjustStock))?
    .GetCustomAttribute<AuthorizeAttribute>();
Assert(stockAdjustmentAuthorization?.Roles == "Admin", "The direct stock-adjustment endpoint must require the Admin role.");

Assert(AssistantImageValidator.TryParse([imageDataUrl], out var images, out _), "Valid JPEG data URL should be accepted.");
Assert(images.Count == 1 && images[0].ContentType == "image/jpeg", "Parsed image metadata should be preserved.");
Assert(!AssistantImageValidator.TryParse(["data:text/plain;base64,YQ=="], out _, out _), "Unsupported media type should be rejected.");
Assert(!AssistantImageValidator.TryParse(["data:image/jpeg;base64,not-base64"], out _, out _), "Malformed base64 should be rejected.");

var oversizedPayload = new string('A', ((AssistantImageValidator.MaxImageBytes + 2) / 3) * 4 + 4);
Assert(!AssistantImageValidator.TryParse([$"data:image/jpeg;base64,{oversizedPayload}"], out _, out _), "Oversized image should be rejected before decoding.");

var handler = new CaptureHandler();
using var httpClient = new HttpClient(handler);
var configuration = new ConfigurationBuilder()
    .AddInMemoryCollection(new Dictionary<string, string?> { ["DEEPSEEK_API_KEY"] = "test-only-key" })
    .Build();
var provider = new DeepSeekAssistantProvider(httpClient, configuration);
await provider.GetResponseAsync("Describe this image", Array.Empty<ChatMessage>(), string.Empty, images, CancellationToken.None);

using var request = JsonDocument.Parse(handler.RequestBody ?? throw new InvalidOperationException("Provider did not send a request."));
var root = request.RootElement;
Assert(root.GetProperty("model").GetString() == "deepseek-flash", "The vision-capable model should be the fallback.");
var userMessage = root.GetProperty("messages").EnumerateArray().Last();
var content = userMessage.GetProperty("content");
Assert(content.ValueKind == JsonValueKind.Array, "Image messages should use content parts.");
var parts = content.EnumerateArray().ToArray();
Assert(parts.Length == 2, "Image messages should include text and image parts.");
Assert(parts[0].GetProperty("type").GetString() == "text", "The first content part should be text.");
Assert(parts[1].GetProperty("type").GetString() == "image_url", "The second content part should be an image.");
Assert(parts[1].GetProperty("image_url").GetProperty("url").GetString() == imageDataUrl, "The image data URL should reach the provider payload.");

const string privateErrorBody = "private prompt and image metadata sentinel";
var errorHandler = new ErrorHandler(privateErrorBody);
using var errorClient = new HttpClient(errorHandler);
var errorProvider = new DeepSeekAssistantProvider(errorClient, configuration);
try
{
    await errorProvider.GetResponseAsync("Describe this image", Array.Empty<ChatMessage>(), string.Empty, images, CancellationToken.None);
    throw new InvalidOperationException("Expected the provider error response to fail.");
}
catch (HttpRequestException ex)
{
    Assert(ex.Message == "DeepSeek error 500.", "Provider errors should expose only the HTTP status code.");
    Assert(!ex.Message.Contains(privateErrorBody, StringComparison.Ordinal), "Provider error bodies must not enter logged exceptions.");
}
Assert(errorHandler.Response?.WasDisposed == true, "Provider error responses should be disposed.");

var extractionErrorHandler = new ErrorHandler(privateErrorBody);
using var extractionErrorClient = new HttpClient(extractionErrorHandler);
var extractionLogger = new CaptureLogger<AssistantProductExtractor>();
var errorExtractor = new AssistantProductExtractor(configuration, extractionErrorClient, extractionLogger);
var failedExtraction = await errorExtractor.ExtractAsync("Reponer 5 unidades del producto TEST Chatbot", Array.Empty<ChatMessage>(), string.Empty, CancellationToken.None);
Assert(failedExtraction.Count == 0, "A failed extraction should return no proposal data.");
Assert(extractionLogger.Entries.All(entry => !entry.Contains(privateErrorBody, StringComparison.Ordinal)), "Extraction provider error bodies must not enter logs.");
Assert(extractionErrorHandler.Response?.WasDisposed == true, "Extraction provider error responses should be disposed.");

Console.WriteLine("Assistant inventory-intent, stock authorization, signed-stock, stock-guard, formatting, vision, and upstream-error checks passed.");

static void Assert(bool condition, string message)
{
    if (!condition) throw new InvalidOperationException(message);
}

static AssistantController CreateAssistantController(CaptureAssistantService assistant, string role)
{
    var user = new ClaimsPrincipal(new ClaimsIdentity(
    [
        new Claim(ClaimTypes.Role, role),
        new Claim("businessId", Guid.NewGuid().ToString()),
        new Claim(ClaimTypes.NameIdentifier, Guid.NewGuid().ToString())
    ],
    "checks"));

    return new AssistantController(assistant, NullLogger<AssistantController>.Instance)
    {
        ControllerContext = new ControllerContext
        {
            HttpContext = new DefaultHttpContext { User = user }
        }
    };
}

sealed class CaptureLogger<T> : ILogger<T>
{
    public List<string> Entries { get; } = [];

    public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => true;

    public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
    {
        Entries.Add(formatter(state, exception));
        if (exception != null) Entries.Add(exception.ToString());
    }
}

sealed class CaptureAssistantService : IAssistantService
{
    public string CurrentProvider => "mock";
    public string[] AvailableProviders => ["mock"];
    public string? LastMessage { get; private set; }
    public bool? CanConfirmStockAdjustments { get; private set; }

    public Task<(string Reply, string Provider, ProposalResponse? Proposal)> GetResponseAsync(
        string message,
        IReadOnlyList<ChatMessage> history,
        IReadOnlyList<AssistantImage> images,
        Guid businessId,
        Guid userId,
        bool canConfirmStockAdjustments,
        CancellationToken ct)
    {
        LastMessage = message;
        CanConfirmStockAdjustments = canConfirmStockAdjustments;
        return Task.FromResult<(string Reply, string Provider, ProposalResponse? Proposal)>(("Check response", "mock", null));
    }
}

sealed class CaptureHandler : HttpMessageHandler
{
    public string? RequestBody { get; private set; }

    protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        RequestBody = await request.Content!.ReadAsStringAsync(cancellationToken);
        return new HttpResponseMessage(HttpStatusCode.OK)
        {
            Content = new StringContent("{\"choices\":[{\"message\":{\"content\":\"Image received\"}}]}", Encoding.UTF8, "application/json")
        };
    }
}

sealed class ErrorHandler(string body) : HttpMessageHandler
{
    public TrackingResponse? Response { get; private set; }

    protected override Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
    {
        var response = new TrackingResponse { Content = new StringContent(body) };
        Response = response;
        return Task.FromResult<HttpResponseMessage>(response);
    }
}

sealed class TrackingResponse : HttpResponseMessage
{
    public TrackingResponse() : base(HttpStatusCode.InternalServerError) { }

    public bool WasDisposed { get; private set; }

    protected override void Dispose(bool disposing)
    {
        WasDisposed = true;
        base.Dispose(disposing);
    }
}
