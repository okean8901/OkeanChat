using Microsoft.EntityFrameworkCore;
using OkeanChat.Models;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;

namespace OkeanChat.Data
{
    public class ApplicationDbContext : IdentityDbContext<ApplicationUser>
    {
        public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options)
            : base(options)
        {
        }

        public DbSet<Channel> Channels { get; set; }
        public DbSet<Message> Messages { get; set; }
        public DbSet<Friendship> Friendships { get; set; }
        public DbSet<PrivateMessage> PrivateMessages { get; set; }

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            base.OnModelCreating(modelBuilder);

            // Configure Channel entity
            modelBuilder.Entity<Channel>(entity =>
            {
                entity.HasIndex(e => e.Name).IsUnique();
            });

            // Configure Message entity
            modelBuilder.Entity<Message>(entity =>
            {
                entity.HasOne(d => d.User)
                    .WithMany(p => p.Messages)
                    .HasForeignKey(d => d.UserId)
                    .OnDelete(DeleteBehavior.Cascade);

                entity.HasOne(d => d.Channel)
                    .WithMany(p => p.Messages)
                    .HasForeignKey(d => d.ChannelId)
                    .OnDelete(DeleteBehavior.Cascade);
            });

            // Configure Friendship entity
            modelBuilder.Entity<Friendship>(entity =>
            {
                entity.HasOne(d => d.Requester)
                    .WithMany(p => p.SentFriendRequests)
                    .HasForeignKey(d => d.RequesterId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Addressee)
                    .WithMany(p => p.ReceivedFriendRequests)
                    .HasForeignKey(d => d.AddresseeId)
                    .OnDelete(DeleteBehavior.Restrict);

                // Ensure unique friendship pairs
                entity.HasIndex(e => new { e.RequesterId, e.AddresseeId }).IsUnique();
            });

            // Configure PrivateMessage entity
            modelBuilder.Entity<PrivateMessage>(entity =>
            {
                entity.HasOne(d => d.Sender)
                    .WithMany(p => p.SentPrivateMessages)
                    .HasForeignKey(d => d.SenderId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasOne(d => d.Receiver)
                    .WithMany(p => p.ReceivedPrivateMessages)
                    .HasForeignKey(d => d.ReceiverId)
                    .OnDelete(DeleteBehavior.Restrict);

                entity.HasIndex(e => new { e.SenderId, e.ReceiverId });
                entity.HasIndex(e => e.CreatedAt);
            });

            // Seed data
            SeedData(modelBuilder);
        }

        private void SeedData(ModelBuilder modelBuilder)
        {
            // Seed Channels
            modelBuilder.Entity<Channel>().HasData(
                new Channel { Id = 1, Name = "Học bài", Description = "Bàn luận chuyện học hành" },
                new Channel { Id = 2, Name = "Chơi game", Description = "Bàn luận chuyện chơi game" },
                new Channel { Id = 3, Name = "Tán phét", Description = "Bàn luận chuyện tán phét" }
            );
        }
    }
}
