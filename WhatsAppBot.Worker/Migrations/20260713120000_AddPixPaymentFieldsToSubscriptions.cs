using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WhatsAppBot.Worker.Migrations
{
    public partial class AddPixPaymentFieldsToSubscriptions : Migration
    {
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "PaymentMode",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: false,
                defaultValue: "manual_pix");

            migrationBuilder.AddColumn<string>(
                name: "PaymentProvider",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: false,
                defaultValue: "manual");

            migrationBuilder.AddColumn<string>(
                name: "PaymentReference",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PixKeySnapshot",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PixPayload",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PixGeneratedAt",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<DateTime>(
                name: "PaymentConfirmedAt",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "PaymentConfirmedBy",
                table: "ClientSubscriptions",
                type: "TEXT",
                nullable: true);
        }

        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(name: "PaymentMode", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PaymentProvider", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PaymentReference", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PixKeySnapshot", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PixPayload", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PixGeneratedAt", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PaymentConfirmedAt", table: "ClientSubscriptions");
            migrationBuilder.DropColumn(name: "PaymentConfirmedBy", table: "ClientSubscriptions");
        }
    }
}
