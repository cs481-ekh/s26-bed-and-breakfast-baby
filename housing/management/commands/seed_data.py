"""
Seed the database with sample data for development and demonstration.
Run with: python manage.py seed_data
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
from housing.models import (
    User, District, Provider, Facility, Program, Bed, Parolee,
    Hold, WaitlistEntry,
)


class Command(BaseCommand):
    help = "Populate the database with sample IDOC housing data"

    def handle(self, *args, **options):
        self.stdout.write("Seeding database...")

        # ---------------------------------------------------------------
        # Districts — Idaho's 7 judicial districts
        # ---------------------------------------------------------------
        districts_data = [
            (1, "First Judicial District", "Benewah, Bonner, Boundary, Kootenai, Shoshone"),
            (2, "Second Judicial District", "Clearwater, Idaho, Latah, Lewis, Nez Perce"),
            (3, "Third Judicial District", "Adams, Canyon, Gem, Owyhee, Payette, Washington"),
            (4, "Fourth Judicial District", "Ada, Boise, Elmore, Valley"),
            (5, "Fifth Judicial District", "Blaine, Camas, Cassia, Gooding, Jerome, Lincoln, Minidoka, Twin Falls"),
            (6, "Sixth Judicial District", "Bannock, Bear Lake, Caribou, Franklin, Oneida, Power"),
            (7, "Seventh Judicial District", "Bingham, Bonneville, Butte, Clark, Custer, Fremont, Jefferson, Lemhi, Madison, Teton"),
        ]
        districts = {}
        for number, name, desc in districts_data:
            d, _ = District.objects.get_or_create(
                number=number, defaults={"name": name, "description": desc}
            )
            districts[number] = d
        self.stdout.write(f"  Created {len(districts)} districts")

        # ---------------------------------------------------------------
        # Providers
        # ---------------------------------------------------------------
        providers_data = [
            ("Idaho Recovery Housing", "Sarah Johnson", "sarah@irh.example.com", "208-555-0101"),
            ("Treasure Valley Transitional", "Mike Chen", "mike@tvt.example.com", "208-555-0102"),
            ("Eastern Idaho Reentry Services", "Lisa Park", "lisa@eirs.example.com", "208-555-0103"),
            ("North Idaho Housing Alliance", "Tom Rivera", "tom@niha.example.com", "208-555-0104"),
            ("Magic Valley Recovery Homes", "Amy Brooks", "amy@mvrh.example.com", "208-555-0105"),
        ]
        providers = []
        for name, contact, email, phone in providers_data:
            p, _ = Provider.objects.get_or_create(
                name=name,
                defaults={
                    "contact_name": contact,
                    "contact_email": email,
                    "contact_phone": phone,
                },
            )
            providers.append(p)
        self.stdout.write(f"  Created {len(providers)} providers")

        # ---------------------------------------------------------------
        # Facilities
        # ---------------------------------------------------------------
        facilities_data = [
            (providers[0], "Boise Recovery House",    "123 Main St",   "Boise",        "83702", 4, "tier_2"),
            (providers[0], "Meridian Sober Living",   "456 Pine Ave",  "Meridian",     "83642", 4, "tier_1"),
            (providers[1], "Canyon House",            "789 Elm St",    "Nampa",        "83651", 3, "tier_2"),
            (providers[1], "Caldwell Transition Home","321 Oak Blvd",  "Caldwell",     "83605", 3, "tier_3"),
            (providers[2], "Idaho Falls Recovery",    "555 River Rd",  "Idaho Falls",  "83401", 7, "tier_2"),
            (providers[2], "Pocatello Reentry House", "222 Center St", "Pocatello",    "83201", 6, "tier_1"),
            (providers[3], "Coeur d'Alene Haven",     "100 Lake Dr",   "Coeur d'Alene","83814", 1, "tier_2"),
            (providers[4], "Twin Falls Recovery",     "444 Blue Rd",   "Twin Falls",   "83301", 5, "tier_3"),
        ]
        facilities = []
        for prov, name, addr, city, zip_code, dist_num, tier in facilities_data:
            f, _ = Facility.objects.get_or_create(
                name=name,
                provider=prov,
                defaults={
                    "address": addr,
                    "city": city,
                    "zip_code": zip_code,
                    "district": districts[dist_num],
                    "tier": tier,
                },
            )
            facilities.append(f)
        self.stdout.write(f"  Created {len(facilities)} facilities")

        # ---------------------------------------------------------------
        # Programs
        # ---------------------------------------------------------------
        programs_data = [
            ("Substance Abuse Treatment", "Residential substance abuse recovery program", "Must have substance abuse history"),
            ("Mental Health Support", "Ongoing mental health counseling and support", "Requires mental health evaluation"),
            ("Work Release", "Employment-focused transitional housing", "Must have employment or active job search"),
            ("General Transitional Housing", "Standard transitional housing without specialized programs", ""),
        ]
        programs = []
        for name, desc, eligibility in programs_data:
            p, _ = Program.objects.get_or_create(
                name=name,
                defaults={"description": desc, "eligibility_criteria": eligibility},
            )
            programs.append(p)

        # Link programs to facilities
        for facility in facilities[:4]:
            facility.programs.add(programs[0], programs[3])
        for facility in facilities[4:6]:
            facility.programs.add(programs[1], programs[2])
        for facility in facilities[6:]:
            facility.programs.add(programs[2], programs[3])
        self.stdout.write(f"  Created {len(programs)} programs")

        # ---------------------------------------------------------------
        # Beds — 4-8 beds per facility
        # ---------------------------------------------------------------
        bed_counts = [6, 4, 8, 5, 6, 4, 7, 5]
        all_beds = []
        for facility, count in zip(facilities, bed_counts):
            for i in range(1, count + 1):
                b, _ = Bed.objects.get_or_create(
                    facility=facility,
                    label=f"Bed {i}",
                )
                all_beds.append(b)
        self.stdout.write(f"  Created {len(all_beds)} beds")

        # ---------------------------------------------------------------
        # Sample Users
        # ---------------------------------------------------------------
        if not User.objects.filter(username="admin").exists():
            User.objects.create_superuser(
                username="admin",
                email="admin@idoc.example.com",
                password="admin123",
                role=User.Role.ADMIN,
            )

        sample_users = [
            ("cm_adams", "Chris", "Adams", User.Role.CASE_MANAGER, 4, None),
            ("cm_baker", "Jamie", "Baker", User.Role.CASE_MANAGER, 3, None),
            ("prov_johnson", "Sarah", "Johnson", User.Role.PROVIDER, None, providers[0]),
            ("prov_chen", "Mike", "Chen", User.Role.PROVIDER, None, providers[1]),
        ]
        for uname, first, last, role, dist_num, prov in sample_users:
            if not User.objects.filter(username=uname).exists():
                User.objects.create_user(
                    username=uname,
                    password="testpass123",
                    first_name=first,
                    last_name=last,
                    role=role,
                    district=districts.get(dist_num),
                    provider=prov,
                )
        self.stdout.write("  Created sample users")

        # ---------------------------------------------------------------
        # Sample Parolees
        # ---------------------------------------------------------------
        parolees_data = [
            ("IDOC-10001", "James", "Wilson", 4),
            ("IDOC-10002", "Robert", "Garcia", 3),
            ("IDOC-10003", "David", "Martinez", 7),
            ("IDOC-10004", "Michael", "Taylor", 4),
            ("IDOC-10005", "William", "Anderson", 1),
        ]
        parolees = []
        for idoc_id, first, last, dist_num in parolees_data:
            p, _ = Parolee.objects.get_or_create(
                idoc_id=idoc_id,
                defaults={
                    "first_name": first,
                    "last_name": last,
                    "district": districts[dist_num],
                },
            )
            parolees.append(p)
        self.stdout.write(f"  Created {len(parolees)} parolees")

        # ---------------------------------------------------------------
        # Sample bed assignments, holds, and waitlist entries
        # ---------------------------------------------------------------

        # Assign first parolee to a bed
        bed = all_beds[0]
        bed.status = Bed.Status.OCCUPIED
        bed.save()
        parolees[0].assigned_bed = bed
        parolees[0].housing_start_date = timezone.now().date() - timedelta(days=14)
        parolees[0].housing_end_date = timezone.now().date() + timedelta(days=76)
        parolees[0].save()

        # Create an active hold
        hold_bed = all_beds[5]
        hold_bed.status = Bed.Status.HELD
        hold_bed.save()
        cm = User.objects.filter(role=User.Role.CASE_MANAGER).first()
        Hold.objects.get_or_create(
            bed=hold_bed,
            parolee=parolees[1],
            defaults={
                "placed_by": cm,
                "reason": "Awaiting program enrollment paperwork",
                "expires_at": timezone.now() + timedelta(hours=48),
            },
        )

        # Create a waitlist entry
        WaitlistEntry.objects.get_or_create(
            parolee=parolees[2],
            facility=facilities[4],
            defaults={
                "added_by": cm,
                "priority": WaitlistEntry.Priority.HIGH,
                "notes": "Needs placement near Idaho Falls for family support",
            },
        )

        self.stdout.write(self.style.SUCCESS("\nDatabase seeded successfully!"))
        self.stdout.write("\nSample login credentials:")
        self.stdout.write("  Admin:        admin / admin123")
        self.stdout.write("  Case Manager: cm_adams / testpass123")
        self.stdout.write("  Provider:     prov_johnson / testpass123")
