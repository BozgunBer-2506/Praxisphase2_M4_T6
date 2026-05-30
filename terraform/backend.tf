terraform {
  backend "s3" {
    bucket = "falkenwacht-terraform-state"
    key    = "terraform.tfstate"
    region = "eu-central-1"
  }
}
