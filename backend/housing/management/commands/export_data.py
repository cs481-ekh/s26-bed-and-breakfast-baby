"""
Export database data to CSV files for inspection and analysis.
Run with:
    python manage.py export_data
    python manage.py export_data --output /path/to/directory
"""

import csv
import os
from django.db.utils import OperationalError
from django.core.management.base import BaseCommand
from housing.models import (
    User, District, Provider, Facility, Program, Bed, Parolee,
    Hold, WaitlistEntry,
)


class Command(BaseCommand):
    help = "Export database data to CSV files"

    def add_arguments(self, parser):
        parser.add_argument(
            "--output",
            type=str,
            default=".",
            help="Output directory for CSV files (default: current directory)",
        )

    def handle(self, *args, **options):
        output_dir = options["output"]
        
        # Create output directory if it doesn't exist
        if not os.path.exists(output_dir):
            os.makedirs(output_dir)
        
        self.stdout.write(f"Exporting data to {output_dir}...")

        try:
            # Export each model to CSV
            self._export_districts(output_dir)
            self._export_providers(output_dir)
            self._export_facilities(output_dir)
            self._export_programs(output_dir)
            self._export_beds(output_dir)
            self._export_users(output_dir)
            self._export_parolees(output_dir)
            self._export_holds(output_dir)
            self._export_waitlist_entries(output_dir)
        except OperationalError as exc:
            self.stderr.write(self.style.ERROR("Database connection failed while exporting CSV data."))
            self.stderr.write(str(exc))
            self.stderr.write(
                "If you are running with Docker, use: "
                "docker compose -f ../docker-compose.yml -f ../docker-compose.dev.yml "
                "exec -T backend python manage.py export_data --output /app/csvout"
            )
            raise

        self.stdout.write(self.style.SUCCESS("Data exported successfully!"))

    def _export_districts(self, output_dir):
        filepath = os.path.join(output_dir, "districts.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "Number", "Name", "Description"])
            for district in District.objects.all():
                writer.writerow([
                    district.id,
                    district.number,
                    district.name,
                    district.description,
                ])
        self.stdout.write(f"  Exported {District.objects.count()} districts")

    def _export_providers(self, output_dir):
        filepath = os.path.join(output_dir, "providers.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "Name", "Contact Name", "Contact Email", "Contact Phone"])
            for provider in Provider.objects.all():
                writer.writerow([
                    provider.id,
                    provider.name,
                    provider.contact_name,
                    provider.contact_email,
                    provider.contact_phone,
                ])
        self.stdout.write(f"  Exported {Provider.objects.count()} providers")

    def _export_facilities(self, output_dir):
        filepath = os.path.join(output_dir, "facilities.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Name", "Provider ID", "Provider Name", "Address", 
                "City", "Zip Code", "District ID", "Tier", 
                "Accepts Male", "Accepts Female", "Accepts Sex Offender"
            ])
            for facility in Facility.objects.select_related("provider", "district"):
                writer.writerow([
                    facility.id,
                    facility.name,
                    facility.provider.id,
                    facility.provider.name,
                    facility.address,
                    facility.city,
                    facility.zip_code,
                    facility.district.id,
                    facility.track,
                    facility.accepts_male,
                    facility.accepts_female,
                    facility.accepts_sex_offender,
                ])
        self.stdout.write(f"  Exported {Facility.objects.count()} facilities")

    def _export_programs(self, output_dir):
        filepath = os.path.join(output_dir, "programs.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["ID", "Name", "Description", "Eligibility Criteria"])
            for program in Program.objects.all():
                writer.writerow([
                    program.id,
                    program.name,
                    program.description,
                    program.eligibility_criteria,
                ])
        self.stdout.write(f"  Exported {Program.objects.count()} programs")

    def _export_beds(self, output_dir):
        filepath = os.path.join(output_dir, "beds.csv")
        assigned_lookup = dict(
            Parolee.objects.filter(assigned_bed__isnull=False).values_list("assigned_bed_id", "idoc_id")
        )
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Facility ID", "Facility Name", "Label", "Status", 
                "Sex Offender Designated", "Assigned Parolee ID", "Updated At"
            ])
            for bed in Bed.objects.select_related("facility"):
                writer.writerow([
                    bed.id,
                    bed.facility.id,
                    bed.facility.name,
                    bed.label,
                    bed.status,
                    bed.is_sex_offender_bed,
                    assigned_lookup.get(bed.id, ""),
                    bed.updated_at,
                ])
        self.stdout.write(f"  Exported {Bed.objects.count()} beds")

    def _export_users(self, output_dir):
        filepath = os.path.join(output_dir, "users.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Username", "First Name", "Last Name", "Email", 
                "Role", "District ID", "Provider ID"
            ])
            for user in User.objects.select_related("district", "provider"):
                writer.writerow([
                    user.id,
                    user.username,
                    user.first_name,
                    user.last_name,
                    user.email,
                    user.role,
                    user.district.id if user.district else "",
                    user.provider.id if user.provider else "",
                ])
        self.stdout.write(f"  Exported {User.objects.count()} users")

    def _export_parolees(self, output_dir):
        filepath = os.path.join(output_dir, "parolees.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "IDOC ID", "First Name", "Last Name", "District ID",
                "Assigned Bed ID", "Housing Start Date", "Housing End Date",
                "Created At", "Updated At"
            ])
            for parolee in Parolee.objects.select_related("assigned_bed"):
                writer.writerow([
                    parolee.id,
                    parolee.idoc_id,
                    parolee.first_name,
                    parolee.last_name,
                    parolee.district.id if parolee.district else "",
                    parolee.assigned_bed.id if parolee.assigned_bed else "",
                    parolee.housing_start_date,
                    parolee.housing_end_date,
                    parolee.created_at,
                    parolee.updated_at,
                ])
        self.stdout.write(f"  Exported {Parolee.objects.count()} parolees")

    def _export_holds(self, output_dir):
        filepath = os.path.join(output_dir, "holds.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Bed ID", "Parolee ID", "Placed By", "Reason", 
                "Expires At", "Created At"
            ])
            for hold in Hold.objects.select_related("bed", "parolee", "placed_by"):
                writer.writerow([
                    hold.id,
                    hold.bed.id,
                    hold.parolee.idoc_id,
                    hold.placed_by.username if hold.placed_by else "",
                    hold.reason,
                    hold.expires_at,
                    hold.created_at,
                ])
        self.stdout.write(f"  Exported {Hold.objects.count()} holds")

    def _export_waitlist_entries(self, output_dir):
        filepath = os.path.join(output_dir, "waitlist_entries.csv")
        with open(filepath, "w", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "ID", "Parolee ID", "Facility ID", "Added By", "Priority",
                "Notes", "Created At"
            ])
            for entry in WaitlistEntry.objects.select_related("parolee", "facility", "added_by"):
                writer.writerow([
                    entry.id,
                    entry.parolee.idoc_id,
                    entry.facility.id,
                    entry.added_by.username if entry.added_by else "",
                    entry.priority,
                    entry.notes,
                    entry.created_at,
                ])
        self.stdout.write(f"  Exported {WaitlistEntry.objects.count()} waitlist entries")
