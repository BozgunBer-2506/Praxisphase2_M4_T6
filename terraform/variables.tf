variable "aws_region" {
  type    = string
  default = "eu-central-1"
}

variable "instance_type" {
  type    = string
  default = "t3.micro"
}

variable "key_name" {
  type    = string
  default = "falkenwacht-key"
}

variable "db_name" {
  type    = string
  default = "dnd_db"
}

variable "db_username" {
  type    = string
  default = "dnd_user"
}

variable "db_password" {
  type      = string
  sensitive = true
}
