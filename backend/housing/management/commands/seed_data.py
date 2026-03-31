"""
Seed the database with sample data for development and demonstration.
Run with:
    python manage.py seed_data
    python manage.py seed_data --size large
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

    def add_arguments(self, parser):
        parser.add_argument(
            "--size",
            choices=["small", "large"],
            default="small",
            help="Dataset size to seed (default: small)",
        )

    def handle(self, *args, **options):
        size = options["size"]
        self.stdout.write(f"Seeding database (size={size})...")

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

        if size == "large":
            self.stdout.write("\nApplying large dataset expansion...")

            # -----------------------------------------------------------
            # Additional providers and facilities
            # -----------------------------------------------------------
            extra_providers = []
            for idx in range(1, 6):
                provider, _ = Provider.objects.get_or_create(
                    name=f"Large Seed Provider {idx}",
                    defaults={
                        "contact_name": f"Provider Contact {idx}",
                        "contact_email": f"large.provider{idx}@idoc.example.com",
                        "contact_phone": f"208-555-{2000 + idx}",
                    },
                )
                extra_providers.append(provider)

            extra_facilities = []
            tiers = [Facility.Tier.TIER_1, Facility.Tier.TIER_2, Facility.Tier.TIER_3]
            for idx in range(1, 16):
                provider = extra_providers[(idx - 1) % len(extra_providers)]
                district_num = ((idx - 1) % 7) + 1
                tier = tiers[(idx - 1) % len(tiers)]
                facility, _ = Facility.objects.get_or_create(
                    name=f"Large Seed Facility {idx}",
                    provider=provider,
                    defaults={
                        "address": f"{1000 + idx} Expansion Ave",
                        "city": "Boise" if idx % 2 == 0 else "Idaho Falls",
                        "zip_code": f"83{200 + idx}",
                        "district": districts[district_num],
                        "tier": tier,
                    },
                )
                # Ensure these facilities have programs linked.
                facility.programs.add(*programs)
                extra_facilities.append(facility)

            facilities.extend(extra_facilities)
            self.stdout.write(f"  Added {len(extra_providers)} providers and {len(extra_facilities)} facilities")

            # -----------------------------------------------------------
            # Additional beds (20 per extra facility)
            # -----------------------------------------------------------
            created_extra_beds = 0
            for facility in extra_facilities:
                for i in range(1, 21):
                    bed, created = Bed.objects.get_or_create(
                        facility=facility,
                        label=f"Expansion Bed {i}",
                    )
                    all_beds.append(bed)
                    if created:
                        created_extra_beds += 1
            self.stdout.write(f"  Added {created_extra_beds} beds")

            # -----------------------------------------------------------
            # Additional users
            # -----------------------------------------------------------
            for idx in range(1, 11):
                username = f"cm_large_{idx}"
                if not User.objects.filter(username=username).exists():
                    User.objects.create_user(
                        username=username,
                        password="testpass123",
                        first_name=f"LargeCM{idx}",
                        last_name="User",
                        role=User.Role.CASE_MANAGER,
                        district=districts[((idx - 1) % 7) + 1],
                    )

            for idx in range(1, 6):
                username = f"prov_large_{idx}"
                if not User.objects.filter(username=username).exists():
                    User.objects.create_user(
                        username=username,
                        password="testpass123",
                        first_name=f"LargeProv{idx}",
                        last_name="User",
                        role=User.Role.PROVIDER,
                        provider=extra_providers[(idx - 1) % len(extra_providers)],
                    )
            self.stdout.write("  Added extra provider/case-manager users")

            # -----------------------------------------------------------
            # Additional parolees and placements
            # -----------------------------------------------------------
            created_parolees = 0
            for idx in range(20000, 20200):
                district_num = ((idx - 20000) % 7) + 1
                _, created = Parolee.objects.get_or_create(
                    idoc_id=f"IDOC-{idx}",
                    defaults={
                        "first_name": f"Parolee{idx}",
                        "last_name": "LargeSeed",
                        "district": districts[district_num],
                    },
                )
                if created:
                    created_parolees += 1
            self.stdout.write(f"  Added {created_parolees} parolees")

            # Assign up to 80 unassigned parolees to available beds.
            unassigned = list(Parolee.objects.filter(assigned_bed__isnull=True).order_by("id")[:80])
            available = list(Bed.objects.filter(status=Bed.Status.AVAILABLE).order_by("id")[:80])
            placed_count = 0
            for parolee, bed in zip(unassigned, available):
                bed.status = Bed.Status.OCCUPIED
                bed.save(update_fields=["status", "updated_at"])
                parolee.assigned_bed = bed
                parolee.housing_start_date = timezone.now().date() - timedelta(days=7)
                parolee.housing_end_date = timezone.now().date() + timedelta(days=53)
                parolee.save(update_fields=["assigned_bed", "housing_start_date", "housing_end_date", "updated_at"])
                placed_count += 1

            # Create extra waitlist entries to make larger list views useful.
            active_cm = User.objects.filter(role=User.Role.CASE_MANAGER).first()
            waitlist_created = 0
            waitlist_pool = list(Parolee.objects.order_by("id")[:120])
            for idx, parolee in enumerate(waitlist_pool, start=1):
                facility = facilities[idx % len(facilities)]
                _, created = WaitlistEntry.objects.get_or_create(
                    parolee=parolee,
                    facility=facility,
                    defaults={
                        "added_by": active_cm,
                        "priority": WaitlistEntry.Priority.MEDIUM,
                        "notes": "Large seed waitlist entry",
                    },
                )
                if created:
                    waitlist_created += 1

            self.stdout.write(
                f"  Added large assignments: {placed_count} placements, {waitlist_created} waitlist entries"
            )

        self.stdout.write(self.style.SUCCESS("\nDatabase seeded successfully!"))
        self.stdout.write("\nSample login credentials:")
        self.stdout.write("  Admin:        admin / admin123")
        self.stdout.write("  Case Manager: cm_adams / testpass123")
        self.stdout.write("  Provider:     prov_johnson / testpass123")
