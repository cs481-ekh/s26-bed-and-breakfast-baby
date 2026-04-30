"""
Seed the database with sample data for development and demonstration.
Run with:
    python manage.py seed_data
    python manage.py seed_data --size large
"""

from django.core.management.base import BaseCommand
from django.utils import timezone
from datetime import timedelta
import random
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

        def random_past_datetime(min_days_ago=0, max_days_ago=1200):
            """Return a random datetime between now-max_days_ago and now-min_days_ago."""
            if max_days_ago < min_days_ago:
                min_days_ago, max_days_ago = max_days_ago, min_days_ago

            now = timezone.now()
            random_days = random.randint(min_days_ago, max_days_ago)
            random_seconds = random.randint(0, 86399)
            return now - timedelta(days=random_days, seconds=random_seconds)

        def mark_sex_offender_beds(target_facilities):
            marked_total = 0
            for facility in target_facilities:
                facility_beds = list(Bed.objects.filter(facility=facility).order_by("id"))
                for index, bed in enumerate(facility_beds[:2], start=1):
                    update_fields = []
                    so_label = f"S/O Bed {index}"
                    if bed.label != so_label:
                        bed.label = so_label
                        update_fields.append("label")
                    if not bed.is_sex_offender_bed:
                        bed.is_sex_offender_bed = True
                        update_fields.append("is_sex_offender_bed")
                    if update_fields:
                        bed.save(update_fields=[*update_fields, "updated_at"])
                marked_total += min(2, len(facility_beds))
            return marked_total

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
            (providers[0], "Boise Recovery House",    "123 Main St",   "Boise",        "83702", 4, Facility.Track.PLUS, True, True, True),
            (providers[0], "Meridian Sober Living",   "456 Pine Ave",  "Meridian",     "83642", 4, Facility.Track.BASIC, True, False, False),
            (providers[1], "Canyon House",            "789 Elm St",    "Nampa",        "83651", 3, Facility.Track.PLUS, True, True, False),
            (providers[1], "Caldwell Transition Home","321 Oak Blvd",  "Caldwell",     "83605", 3, Facility.Track.BASIC, False, True, False),
            (providers[2], "Idaho Falls Recovery",    "555 River Rd",  "Idaho Falls",  "83401", 7, Facility.Track.PLUS, True, True, True),
            (providers[2], "Pocatello Reentry House", "222 Center St", "Pocatello",    "83201", 6, Facility.Track.BASIC, True, False, False),
            (providers[3], "Coeur d'Alene Haven",     "100 Lake Dr",   "Coeur d'Alene","83814", 1, Facility.Track.PLUS, False, True, False),
            (providers[4], "Twin Falls Recovery",     "444 Blue Rd",   "Twin Falls",   "83301", 5, Facility.Track.BASIC, True, True, True),
        ]
        facilities = []
        for prov, name, addr, city, zip_code, dist_num, track, accepts_male, accepts_female, accepts_sex_offender in facilities_data:
            f, _ = Facility.objects.get_or_create(
                name=name,
                provider=prov,
                defaults={
                    "address": addr,
                    "city": city,
                    "zip_code": zip_code,
                    "district": districts[dist_num],
                    "track": track,
                    "accepts_male": accepts_male,
                    "accepts_female": accepts_female,
                    "accepts_sex_offender": accepts_sex_offender,
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

        # Designate up to 2 sex-offender beds for a subset of eligible facilities.
        small_so_facilities = [
            facility for facility in facilities
            if facility.name in {"Boise Recovery House", "Idaho Falls Recovery"} and facility.accepts_sex_offender
        ]
        marked_small = mark_sex_offender_beds(small_so_facilities)
        self.stdout.write(f"  Marked {marked_small} sex-offender designated beds")

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
            ("staff_adams", "Chris", "Adams", User.Role.IDOC_STAFF, 4, None),
            ("staff_baker", "Jamie", "Baker", User.Role.IDOC_STAFF, 3, None),
            ("staff_stone", "Alex", "Stone", User.Role.IDOC_STAFF, 4, None),
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

            # Spread seeded clients across a realistic timeline for dashboards and filtering.
            random_created_at = random_past_datetime(min_days_ago=30, max_days_ago=1400)
            Parolee.objects.filter(pk=p.pk).update(created_at=random_created_at)
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
        cm = User.objects.filter(role=User.Role.IDOC_STAFF).first()
        hold, _ = Hold.objects.get_or_create(
            bed=hold_bed,
            parolee=parolees[1],
            defaults={
                "placed_by": cm,
                "reason": "Awaiting program enrollment paperwork",
                "expires_at": timezone.now() + timedelta(days=7),
            },
        )
        Hold.objects.filter(pk=hold.pk).update(created_at=random_past_datetime(min_days_ago=1, max_days_ago=180))

        # Create a waitlist entry
        waitlist_entry, _ = WaitlistEntry.objects.get_or_create(
            parolee=parolees[2],
            facility=facilities[4],
            defaults={
                "added_by": cm,
                "priority": WaitlistEntry.Priority.HIGH,
                "notes": "Needs placement near Idaho Falls for family support",
            },
        )
        WaitlistEntry.objects.filter(pk=waitlist_entry.pk).update(created_at=random_past_datetime(min_days_ago=1, max_days_ago=365))

        if size == "large":
            self.stdout.write("\nApplying large dataset expansion...")

            # -----------------------------------------------------------
            # Additional providers and facilities
            # -----------------------------------------------------------
            extra_providers_data = [
                ("Gem State Reentry Housing", "Rachel Moore", "rachel@gsrh.example.com", "208-555-0201"),
                ("Snake River Transitional Services", "Daniel Brooks", "daniel@srts.example.com", "208-555-0202"),
                ("Panhandle Recovery Network", "Monica Hayes", "monica@prn.example.com", "208-555-0203"),
                ("Southeast Idaho Housing Partners", "Kevin Lawson", "kevin@sihp.example.com", "208-555-0204"),
                ("High Desert Community Housing", "Erin Flores", "erin@hdch.example.com", "208-555-0205"),
            ]
            extra_providers = []
            for name, contact, email, phone in extra_providers_data:
                provider, _ = Provider.objects.get_or_create(
                    name=name,
                    defaults={
                        "contact_name": contact,
                        "contact_email": email,
                        "contact_phone": phone,
                    },
                )
                extra_providers.append(provider)

            extra_facilities_data = [
                ("Boise Bridge House", "1101 River St", "Boise", "83703", 4, Facility.Track.PLUS, True, False, False),
                ("Meridian Pathways Home", "2210 Fairview Ave", "Meridian", "83642", 4, Facility.Track.BASIC, False, True, False),
                ("Nampa Renewal Center", "785 Front St", "Nampa", "83651", 3, Facility.Track.PLUS, True, True, True),
                ("Caldwell New Start Residence", "402 Arthur St", "Caldwell", "83605", 3, Facility.Track.BASIC, False, True, False),
                ("Idaho Falls Riverbend House", "1542 Skyline Dr", "Idaho Falls", "83402", 7, Facility.Track.PLUS, True, True, False),
                ("Pocatello Independence Home", "633 Grant Ave", "Pocatello", "83204", 6, Facility.Track.BASIC, True, False, False),
                ("Twin Falls Horizon House", "912 Addison Ave", "Twin Falls", "83301", 5, Facility.Track.PLUS, True, True, True),
                ("Lewiston Gateway Residence", "301 Thain Rd", "Lewiston", "83501", 2, Facility.Track.PLUS, True, True, False),
                ("Moscow Stability House", "111 Main St", "Moscow", "83843", 2, Facility.Track.BASIC, False, True, False),
                ("Coeur d'Alene Harbor Home", "709 Sherman Ave", "Coeur d'Alene", "83814", 1, Facility.Track.PLUS, False, True, False),
                ("Post Falls Community House", "120 Spokane St", "Post Falls", "83854", 1, Facility.Track.BASIC, True, False, True),
                ("Burley Turning Point", "88 Overland Ave", "Burley", "83318", 5, Facility.Track.BASIC, True, True, False),
                ("Rexburg Sunrise Home", "240 College Ave", "Rexburg", "83440", 7, Facility.Track.PLUS, True, True, False),
                ("Mountain Home Transit House", "515 Airbase Rd", "Mountain Home", "83647", 4, Facility.Track.BASIC, True, False, False),
                ("Sandpoint Lakeside Residence", "63 Cedar St", "Sandpoint", "83864", 1, Facility.Track.PLUS, True, True, False),
            ]
            extra_facilities = []
            for idx, (name, addr, city, zip_code, district_num, track, accepts_male, accepts_female, accepts_sex_offender) in enumerate(extra_facilities_data, start=1):
                provider = extra_providers[(idx - 1) % len(extra_providers)]
                facility, _ = Facility.objects.get_or_create(
                    name=name,
                    provider=provider,
                    defaults={
                        "address": addr,
                        "city": city,
                        "zip_code": zip_code,
                        "district": districts[district_num],
                        "track": track,
                        "accepts_male": accepts_male,
                        "accepts_female": accepts_female,
                        "accepts_sex_offender": accepts_sex_offender,
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
                        label=f"Bed {i}",
                    )
                    all_beds.append(bed)
                    if created:
                        created_extra_beds += 1
            self.stdout.write(f"  Added {created_extra_beds} beds")

            large_so_facilities = [
                facility for facility in extra_facilities
                if facility.accepts_sex_offender and facility.name in {"Nampa Renewal Center", "Twin Falls Horizon House", "Post Falls Community House"}
            ]
            marked_large = mark_sex_offender_beds(large_so_facilities)
            self.stdout.write(f"  Marked {marked_large} additional sex-offender designated beds")

            # -----------------------------------------------------------
            # Additional users
            # -----------------------------------------------------------
            extra_staff = [
                ("staff_clark", "Jordan", "Clark", 1),
                ("staff_diaz", "Taylor", "Diaz", 2),
                ("staff_evans", "Morgan", "Evans", 3),
                ("staff_foster", "Riley", "Foster", 4),
                ("staff_grant", "Casey", "Grant", 5),
                ("staff_hughes", "Avery", "Hughes", 6),
                ("staff_ivy", "Drew", "Ivy", 7),
                ("staff_kim", "Parker", "Kim", 4),
                ("staff_lopez", "Reese", "Lopez", 3),
                ("staff_morris", "Quinn", "Morris", 5),
            ]
            for username, first, last, district_num in extra_staff:
                if not User.objects.filter(username=username).exists():
                    User.objects.create_user(
                        username=username,
                        password="testpass123",
                        first_name=first,
                        last_name=last,
                        role=User.Role.IDOC_STAFF,
                        district=districts[district_num],
                    )

            extra_provider_users = [
                ("prov_moore", "Rachel", "Moore"),
                ("prov_brooks", "Daniel", "Brooks"),
                ("prov_hayes", "Monica", "Hayes"),
                ("prov_lawson", "Kevin", "Lawson"),
                ("prov_flores", "Erin", "Flores"),
            ]
            for idx, (username, first, last) in enumerate(extra_provider_users, start=1):
                if not User.objects.filter(username=username).exists():
                    User.objects.create_user(
                        username=username,
                        password="testpass123",
                        first_name=first,
                        last_name=last,
                        role=User.Role.PROVIDER,
                        provider=extra_providers[(idx - 1) % len(extra_providers)],
                    )
            self.stdout.write("  Added extra provider/IDOC-staff users")

            # -----------------------------------------------------------
            # Additional parolees and placements
            # -----------------------------------------------------------
            first_names = [
                "Anthony", "Brian", "Carlos", "Derrick", "Ethan", "Frank", "George", "Henry", "Isaac", "Jason",
                "Kevin", "Logan", "Marcus", "Nathan", "Oscar", "Patrick", "Ramon", "Samuel", "Travis", "Victor",
                "Wesley", "Xavier", "Yuri", "Zane", "Caleb",
            ]
            last_names = [
                "Bennett", "Carter", "Diaz", "Edwards", "Fisher", "Gonzalez", "Harris", "Irwin", "Jackson", "Kelly",
                "Lawrence", "Mitchell", "Nelson", "Owens", "Perry", "Quintero", "Reed", "Sullivan", "Turner", "Vasquez",
                "Walker", "Young", "Zimmerman", "Abbott", "Bradley", "Collins", "Donovan", "Ellis", "Fleming", "Griffin",
                "Henderson",
            ]
            created_parolees = 0
            for idx in range(20000, 20200):
                district_num = ((idx - 20000) % 7) + 1
                offset = idx - 20000
                parolee, created = Parolee.objects.get_or_create(
                    idoc_id=f"IDOC-{idx}",
                    defaults={
                        "first_name": first_names[offset % len(first_names)],
                        "last_name": last_names[(offset * 7) % len(last_names)],
                        "district": districts[district_num],
                    },
                )
                random_created_at = random_past_datetime(min_days_ago=15, max_days_ago=1700)
                Parolee.objects.filter(pk=parolee.pk).update(created_at=random_created_at)
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
            active_cm = User.objects.filter(role=User.Role.IDOC_STAFF).first()
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
                        "notes": "Requested placement near support services and transportation routes",
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
        self.stdout.write("  IDOC Staff:   staff_adams / testpass123")
        self.stdout.write("  Provider:     prov_johnson / testpass123")
        self.stdout.write("  (Also):       staff_stone / testpass123")
