using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

#pragma warning disable CA1814 // Prefer jagged arrays over multidimensional

namespace OkeanChat.Migrations
{
    /// <inheritdoc />
    public partial class InitialCreate : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "Channels",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Name = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Description = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Channels", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Users",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Username = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    Email = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: false),
                    Avatar = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    LastSeen = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Users", x => x.Id);
                });

            migrationBuilder.CreateTable(
                name: "Messages",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    Content = table.Column<string>(type: "nvarchar(2000)", maxLength: 2000, nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    EditedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    IsEdited = table.Column<bool>(type: "bit", nullable: false),
                    UserId = table.Column<int>(type: "int", nullable: false),
                    ChannelId = table.Column<int>(type: "int", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_Messages", x => x.Id);
                    table.ForeignKey(
                        name: "FK_Messages_Channels_ChannelId",
                        column: x => x.ChannelId,
                        principalTable: "Channels",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_Messages_Users_UserId",
                        column: x => x.UserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.InsertData(
                table: "Channels",
                columns: new[] { "Id", "CreatedAt", "Description", "IsActive", "Name" },
                values: new object[,]
                {
                    { 1, new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(5901), "General discussion channel", true, "general" },
                    { 2, new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(5906), "Random chat and off-topic discussions", true, "random" },
                    { 3, new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(5907), "Important announcements", true, "announcements" }
                });

            migrationBuilder.InsertData(
                table: "Users",
                columns: new[] { "Id", "Avatar", "CreatedAt", "Email", "LastSeen", "Username" },
                values: new object[,]
                {
                    { 1, "https://via.placeholder.com/40/7289da/ffffff?text=A", new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(6013), "admin@okeanchat.com", new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(6013), "Admin" },
                    { 2, "https://via.placeholder.com/40/43b581/ffffff?text=T", new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(6016), "test@okeanchat.com", new DateTime(2025, 10, 22, 5, 24, 4, 416, DateTimeKind.Utc).AddTicks(6017), "TestUser" }
                });

            migrationBuilder.InsertData(
                table: "Messages",
                columns: new[] { "Id", "ChannelId", "Content", "CreatedAt", "EditedAt", "IsEdited", "UserId" },
                values: new object[,]
                {
                    { 1, 1, "Welcome to OkeanChat! 🚀", new DateTime(2025, 10, 22, 4, 54, 4, 416, DateTimeKind.Utc).AddTicks(6034), null, false, 1 },
                    { 2, 1, "Hello everyone! 👋", new DateTime(2025, 10, 22, 4, 59, 4, 416, DateTimeKind.Utc).AddTicks(6038), null, false, 2 },
                    { 3, 2, "This is a test message in random channel", new DateTime(2025, 10, 22, 5, 4, 4, 416, DateTimeKind.Utc).AddTicks(6040), null, false, 1 }
                });

            migrationBuilder.CreateIndex(
                name: "IX_Channels_Name",
                table: "Channels",
                column: "Name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Messages_ChannelId",
                table: "Messages",
                column: "ChannelId");

            migrationBuilder.CreateIndex(
                name: "IX_Messages_UserId",
                table: "Messages",
                column: "UserId");

            migrationBuilder.CreateIndex(
                name: "IX_Users_Email",
                table: "Users",
                column: "Email",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_Users_Username",
                table: "Users",
                column: "Username",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "Messages");

            migrationBuilder.DropTable(
                name: "Channels");

            migrationBuilder.DropTable(
                name: "Users");
        }
    }
}
