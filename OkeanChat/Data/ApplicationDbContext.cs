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

            // Seed data
            SeedData(modelBuilder);
        }

        private void SeedData(ModelBuilder modelBuilder)
        {
            // Seed Channels
            modelBuilder.Entity<Channel>().HasData(
                new Channel { Id = 1, Name = "general", Description = "General discussion channel" },
                new Channel { Id = 2, Name = "random", Description = "Random chat and off-topic discussions" },
                new Channel { Id = 3, Name = "announcements", Description = "Important announcements" }
            );
        }
    }
}
