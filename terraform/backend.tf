terraform {
  backend "s3" {
    bucket = "falkenwacht-t6-terraform-state"
    key    = "terraform.tfstate"
    region = "eu-central-1"
  }
}
