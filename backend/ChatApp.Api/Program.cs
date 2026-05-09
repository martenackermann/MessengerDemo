using ChatApp.Api.Core.Interfaces;
using ChatApp.Api.Core.Services;
using ChatApp.Api.Infrastructure.Data;
using ChatApp.Api.Hubs;
using ChatApp.Api.Core.Models;
using Microsoft.AspNetCore.Builder;
using Microsoft.Extensions.DependencyInjection;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();
builder.Services.AddSingleton<IChatRepository, InMemoryChatRepository>();
builder.Services.AddScoped<IChatService, ChatService>();

builder.Services.AddCors(options =>
{
    options.AddPolicy("CorsPolicy", policy =>
    {
        policy
            .WithOrigins("http://localhost:5173")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    });
});

var app = builder.Build();

app.UseRouting();

app.UseCors("CorsPolicy");

app.MapHub<ChatHub>("/chatHub");


app.Run();