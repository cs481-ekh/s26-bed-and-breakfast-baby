from django.core.exceptions import ValidationError
from django.test import TestCase

from housing.models import Bed, District, Facility, Provider


class BedSexOffenderDesignationTests(TestCase):
	def setUp(self):
		self.district = District.objects.create(number=99, name="Validation District")
		self.provider = Provider.objects.create(name="Validation Provider")

	def test_facility_allows_at_most_two_designated_sex_offender_beds(self):
		facility = Facility.objects.create(
			provider=self.provider,
			name="Designated Bed Facility",
			address="10 Test St",
			city="Boise",
			state="ID",
			zip_code="83701",
			district=self.district,
			tier=Facility.Tier.TIER_1,
			accepts_sex_offender=True,
		)

		Bed.objects.create(facility=facility, label="Bed 1", is_sex_offender_bed=True)
		Bed.objects.create(facility=facility, label="Bed 2", is_sex_offender_bed=True)

		with self.assertRaises(ValidationError):
			Bed.objects.create(facility=facility, label="Bed 3", is_sex_offender_bed=True)

	def test_designated_bed_requires_facility_sex_offender_eligibility(self):
		facility = Facility.objects.create(
			provider=self.provider,
			name="Ineligible Facility",
			address="11 Test St",
			city="Boise",
			state="ID",
			zip_code="83701",
			district=self.district,
			tier=Facility.Tier.TIER_2,
			accepts_sex_offender=False,
		)

		with self.assertRaises(ValidationError):
			Bed.objects.create(facility=facility, label="Bed 1", is_sex_offender_bed=True)
